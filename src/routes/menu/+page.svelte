<script lang="ts">
	import { menuDb, ingredientsDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatUsd, formatQty } from '$lib/utils/format';
	import { uuidv7 } from '$lib/utils/id';
	import { SvelteMap } from 'svelte/reactivity';
	import type { MenuCategory, MenuItem, IngredientStock, RecipeLine } from '$lib/types';

	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Icon from '$lib/components/Icon.svelte';

	type Tab = 'menu' | 'recipes';

	// Editable recipe row in the form (client-side, keyed for #each).
	type RecipeRow = { key: string; ingredient_id: string; qty: string };

	let activeTab = $state<Tab>('menu');

	let loading = $state(true);
	let categories = $state<MenuCategory[]>([]);
	let items = $state<MenuItem[]>([]);
	let ingredients = $state<IngredientStock[]>([]);

	// Recipes tab joined data: menu_item_id -> [{ ingredient_id, qty_required }]
	let recipesByItem = $state<Map<string, { ingredient_id: string; qty_required: number }[]>>(
		new Map()
	);

	// ── Editor panel state ──────────────────────────────────────────────────
	let panelOpen = $state(false);
	let saving = $state(false);
	let editingId = $state<string | null>(null);
	let recipeLoading = $state(false);

	let formName = $state('');
	let formDescription = $state('');
	let formPrice = $state('');
	let formCategoryId = $state('');
	let formAvailable = $state(true);
	let recipeRows = $state<RecipeRow[]>([]);
	let nameError = $state('');
	let priceError = $state('');

	let confirmDeleteOpen = $state(false);

	// Per-item busy flag for the availability toggle.
	let togglingId = $state<string | null>(null);

	const categoryOptions = $derived(categories.map((c) => ({ value: c.id, label: c.name })));
	const ingredientOptions = $derived(ingredients.map((i) => ({ value: i.id, label: i.name })));
	const ingredientById = $derived(new Map(ingredients.map((i) => [i.id, i])));

	// Items grouped by category id; null category collected under '' key.
	const itemsByCategory = $derived.by(() => {
		const map = new SvelteMap<string, MenuItem[]>();
		for (const it of items) {
			const key = it.category_id ?? '';
			const arr = map.get(key) ?? [];
			arr.push(it);
			map.set(key, arr);
		}
		return map;
	});
	const uncategorized = $derived(itemsByCategory.get('') ?? []);

	async function loadAll() {
		loading = true;
		try {
			const [cats, its, ings, allRecipes] = await Promise.all([
				menuDb.categories.list(),
				menuDb.items.list(),
				ingredientsDb.items.list(),
				menuDb.recipes.listAll()
			]);
			categories = cats;
			items = its;
			ingredients = ings;
			const map = new SvelteMap<string, { ingredient_id: string; qty_required: number }[]>();
			for (const r of allRecipes) {
				const arr = map.get(r.menu_item_id) ?? [];
				arr.push({ ingredient_id: r.ingredient_id, qty_required: r.qty_required });
				map.set(r.menu_item_id, arr);
			}
			recipesByItem = map;
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadAll();
	});

	async function toggleAvailable(item: MenuItem) {
		togglingId = item.id;
		try {
			await menuDb.items.update(item.id, { is_available: !item.is_available });
			items = items.map((it) =>
				it.id === item.id ? { ...it, is_available: !it.is_available } : it
			);
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			togglingId = null;
		}
	}

	function resetForm() {
		formName = '';
		formDescription = '';
		formPrice = '';
		formCategoryId = categories[0]?.id ?? '';
		formAvailable = true;
		recipeRows = [];
		nameError = '';
		priceError = '';
	}

	function openCreate() {
		editingId = null;
		resetForm();
		panelOpen = true;
	}

	async function openEdit(item: MenuItem) {
		editingId = item.id;
		formName = item.name;
		formDescription = item.description ?? '';
		formPrice = String(item.price_usd);
		formCategoryId = item.category_id ?? '';
		formAvailable = item.is_available;
		nameError = '';
		priceError = '';
		recipeRows = [];
		panelOpen = true;

		recipeLoading = true;
		try {
			const lines: RecipeLine[] = await menuDb.recipes.listForItem(item.id);
			recipeRows = lines.map((l) => ({
				key: uuidv7(),
				ingredient_id: l.ingredient_id,
				qty: String(l.qty_required)
			}));
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			recipeLoading = false;
		}
	}

	function addRecipeRow() {
		recipeRows = [
			...recipeRows,
			{ key: uuidv7(), ingredient_id: ingredients[0]?.id ?? '', qty: '' }
		];
	}

	function removeRecipeRow(key: string) {
		recipeRows = recipeRows.filter((r) => r.key !== key);
	}

	async function save() {
		nameError = '';
		priceError = '';
		const name = formName.trim();
		const price = Number(formPrice);
		if (!name) {
			nameError = t('validation.required');
		}
		if (!formPrice.trim() || Number.isNaN(price)) {
			priceError = t('validation.invalidNumber');
		} else if (price < 0) {
			priceError = t('validation.mustBePositive');
		}
		if (nameError || priceError) return;

		saving = true;
		try {
			const payload = {
				name,
				description: formDescription.trim() || null,
				price_usd: price,
				is_available: formAvailable,
				category_id: formCategoryId || null
			};
			const itemId = editingId
				? (await menuDb.items.update(editingId, payload)).id
				: (await menuDb.items.create(payload)).id;

			const recipeLines = recipeRows
				.filter((r) => r.ingredient_id && r.qty.trim() && Number(r.qty) > 0)
				.map((r) => ({ ingredient_id: r.ingredient_id, qty_required: Number(r.qty) }));
			await menuDb.recipes.setForItem(itemId, recipeLines);

			toast.success(t('menu.saved'));
			panelOpen = false;
			await loadAll();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			saving = false;
		}
	}

	async function confirmDelete() {
		if (!editingId) return;
		const id = editingId;
		try {
			await menuDb.items.delete(id);
			toast.success(t('toasts.deleted'));
			panelOpen = false;
			editingId = null;
			await loadAll();
		} catch {
			toast.error(t('toasts.saveFailed'));
		}
	}
</script>

<div class="page flex flex-col gap-4">
	{#if activeTab === 'menu'}
		<header class="flex justify-end">
			<Button icon="plus" onclick={openCreate}>{t('menu.addItem')}</Button>
		</header>
	{/if}

	<!-- Tabs -->
	<div class="tabs flex" role="tablist">
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'menu'}
			class="tab"
			class:tab-active={activeTab === 'menu'}
			onclick={() => (activeTab = 'menu')}
		>
			{t('menu.tabMenu')}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === 'recipes'}
			class="tab"
			class:tab-active={activeTab === 'recipes'}
			onclick={() => (activeTab = 'recipes')}
		>
			{t('menu.tabRecipes')}
		</button>
	</div>

	{#if loading}
		<div class="flex justify-center p-8">
			<LoadingSpinner size="lg" />
		</div>
	{:else if items.length === 0}
		<EmptyState icon="utensils" title={t('menu.noItems')}>
			{#snippet action()}
				<Button icon="plus" onclick={openCreate}>{t('menu.addItem')}</Button>
			{/snippet}
		</EmptyState>
	{:else if activeTab === 'menu'}
		<!-- ── MENU TAB ─────────────────────────────────────────── -->
		<div class="flex flex-col gap-6">
			{#each categories as category (category.id)}
				{@const catItems = itemsByCategory.get(category.id) ?? []}
				{#if catItems.length > 0}
					<section class="flex flex-col gap-3">
						<div
							class="category-header flex items-center gap-2"
							style="--cat-color: {category.color}"
						>
							<span class="cat-name">{category.name}</span>
						</div>
						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
							{#each catItems as item (item.id)}
								{@render itemCard(item)}
							{/each}
						</div>
					</section>
				{/if}
			{/each}

			{#if uncategorized.length > 0}
				<section class="flex flex-col gap-3">
					<div
						class="category-header flex items-center gap-2"
						style="--cat-color: var(--color-text-muted)"
					>
						<span class="cat-name">{t('common.none')}</span>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each uncategorized as item (item.id)}
							{@render itemCard(item)}
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{:else}
		<!-- ── RECIPES TAB ──────────────────────────────────────── -->
		<div class="flex flex-col gap-3">
			{#each items as item (item.id)}
				{@const lines = recipesByItem.get(item.id) ?? []}
				<Card>
					<div class="flex flex-col gap-2">
						<div class="flex items-center justify-between gap-2">
							<span class="item-name">{item.name}</span>
							<span class="item-price tabular-nums">{formatUsd(item.price_usd)}</span>
						</div>
						{#if lines.length === 0}
							<p class="no-recipe">{t('menu.noRecipe')}</p>
						{:else}
							<ul class="recipe-list flex flex-col gap-1">
								{#each lines as line (line.ingredient_id)}
									{@const ing = ingredientById.get(line.ingredient_id)}
									<li class="recipe-row flex items-center justify-between gap-2">
										<span class="recipe-ing">{ing?.name ?? '—'}</span>
										<span class="recipe-qty tabular-nums">
											{formatQty(line.qty_required, ing?.unit)}
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Reusable menu item card -->
{#snippet itemCard(item: MenuItem)}
	<Card padding="none">
		<div class="item-card flex flex-col gap-3 p-4">
			<div class="flex items-start justify-between gap-2">
				<div class="flex flex-col gap-0.5 min-w-0">
					<span class="item-name truncate">{item.name}</span>
					{#if item.description}
						<span class="item-desc truncate">{item.description}</span>
					{/if}
				</div>
				<span class="item-price tabular-nums">{formatUsd(item.price_usd)}</span>
			</div>

			<div class="flex items-center justify-between gap-2">
				<button
					type="button"
					class="avail-toggle"
					class:avail-on={item.is_available}
					aria-pressed={item.is_available}
					disabled={togglingId === item.id}
					onclick={() => toggleAvailable(item)}
				>
					<Badge variant={item.is_available ? 'success' : 'neutral'}>
						{item.is_available ? t('menu.available') : t('menu.unavailable')}
					</Badge>
				</button>
				<Button variant="ghost" size="sm" onclick={() => openEdit(item)}>
					{t('common.edit')}
				</Button>
			</div>
		</div>
	</Card>
{/snippet}

<!-- ── Editor panel (Modal) ─────────────────────────────────── -->
<Modal bind:open={panelOpen} title={editingId ? t('menu.editItem') : t('menu.addItem')}>
	<form
		class="flex flex-col gap-4"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<Input label={t('menu.name')} bind:value={formName} error={nameError} />
		<Input label={t('menu.description')} bind:value={formDescription} />
		<Input
			label={t('menu.price')}
			bind:value={formPrice}
			type="number"
			inputmode="decimal"
			error={priceError}
		/>
		<Select
			label={t('menu.category')}
			bind:value={formCategoryId}
			options={categoryOptions}
			placeholder={t('common.none')}
		/>

		<!-- Available toggle -->
		<div class="flex items-center justify-between gap-2">
			<span class="field-label">{t('menu.available')}</span>
			<button
				type="button"
				class="switch"
				class:switch-on={formAvailable}
				role="switch"
				aria-checked={formAvailable}
				aria-label={t('menu.available')}
				onclick={() => (formAvailable = !formAvailable)}
			>
				<span class="switch-knob"></span>
			</button>
		</div>

		<!-- Recipe section -->
		<div class="recipe-section flex flex-col gap-3">
			<div class="flex items-center justify-between gap-2">
				<span class="section-title">{t('menu.recipe')}</span>
				<Button variant="secondary" size="sm" onclick={addRecipeRow}>
					+ {t('menu.addIngredient')}
				</Button>
			</div>

			{#if recipeLoading}
				<div class="flex justify-center p-3">
					<LoadingSpinner size="sm" />
				</div>
			{:else if recipeRows.length === 0}
				<p class="no-recipe">{t('menu.noRecipe')}</p>
			{:else}
				<div class="flex flex-col gap-2">
					{#each recipeRows as row (row.key)}
						<div class="recipe-edit-row flex items-end gap-2">
							<div class="flex-1 min-w-0">
								<Select
									bind:value={row.ingredient_id}
									options={ingredientOptions}
									placeholder={t('menu.ingredient')}
								/>
							</div>
							<div class="qty-field">
								<Input
									bind:value={row.qty}
									type="number"
									inputmode="decimal"
									placeholder={t('menu.qtyRequired')}
								/>
							</div>
							<button
								type="button"
								class="remove-btn"
								aria-label={t('common.delete')}
								onclick={() => removeRecipeRow(row.key)}
							>
								<Icon name="x" size={18} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer actions -->
		<div class="form-footer flex items-center gap-2">
			{#if editingId}
				<Button variant="danger" onclick={() => (confirmDeleteOpen = true)}>
					{t('common.delete')}
				</Button>
			{/if}
			<div class="flex-1"></div>
			<Button variant="ghost" onclick={() => (panelOpen = false)}>
				{t('common.cancel')}
			</Button>
			<Button type="submit" loading={saving}>
				{saving ? t('common.saving') : t('common.save')}
			</Button>
		</div>
	</form>
</Modal>

<ConfirmDialog
	bind:open={confirmDeleteOpen}
	message={t('menu.deleteConfirm')}
	confirmLabel={t('common.delete')}
	danger
	onconfirm={confirmDelete}
/>

<style>
	.page {
		padding: 24px 26px 44px;
	}

	.tabs {
		gap: 4px;
		border-bottom: 1px solid var(--color-line);
	}

	.tab {
		min-height: 48px;
		padding: 0 16px;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		color: var(--color-text-dim);
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab-active {
		color: var(--color-mustard);
		border-bottom-color: var(--color-mustard);
	}

	.category-header {
		padding-left: 10px;
		border-left: 4px solid var(--cat-color);
	}

	.cat-name {
		font-family: var(--font-sans);
		font-weight: 800;
		font-size: 1.125rem;
		color: var(--color-text);
	}

	@media (max-width: 640px) {
		.page {
			padding: 18px 16px 80px;
		}
	}

	.item-card {
		transition: transform 150ms ease;
	}

	.item-name {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 1rem;
		color: var(--color-text-primary);
	}

	.item-desc {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.item-price {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1rem;
		color: var(--color-text-primary);
	}

	.avail-toggle {
		background: transparent;
		border: none;
		padding: 6px 0;
		min-height: 48px;
		display: flex;
		align-items: center;
		cursor: pointer;
		transition: transform 150ms ease;
	}

	.avail-toggle:active:not(:disabled) {
		transform: scale(0.95);
	}

	.avail-toggle:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.no-recipe {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	.recipe-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.recipe-row {
		padding: 4px 0;
		border-bottom: 1px solid var(--color-surface-overlay);
	}

	.recipe-row:last-child {
		border-bottom: none;
	}

	.recipe-ing {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
	}

	.recipe-qty {
		font-family: var(--font-mono);
		font-size: 0.9375rem;
		color: var(--color-text-primary);
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
	}

	.section-title {
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 1rem;
		color: var(--color-text-primary);
	}

	.recipe-section {
		padding-top: 12px;
		border-top: 1px solid var(--color-surface-overlay);
	}

	.qty-field {
		width: 96px;
		flex-shrink: 0;
	}

	.remove-btn {
		min-width: 48px;
		min-height: 48px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		background: transparent;
		border: 1px solid var(--color-line-2);
		border-radius: var(--radius-md);
		color: var(--color-red);
		cursor: pointer;
		transition:
			background 150ms ease,
			transform 150ms ease;
	}

	.remove-btn:hover {
		background: color-mix(in srgb, var(--color-red) 14%, transparent);
	}

	.remove-btn:active {
		transform: scale(0.92);
	}

	.form-footer {
		padding-top: 8px;
	}

	/* Switch toggle */
	.switch {
		position: relative;
		width: 52px;
		height: 32px;
		flex-shrink: 0;
		border: none;
		border-radius: var(--radius-full);
		background: var(--color-surface-3);
		cursor: pointer;
		transition: background 150ms ease;
		padding: 0;
	}

	.switch-on {
		background: var(--color-green);
	}

	.switch-knob {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
		background: var(--color-text);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		transition: transform 150ms ease;
	}

	.switch-on .switch-knob {
		background: var(--color-success-fg);
	}

	.switch-on .switch-knob {
		transform: translateX(20px);
	}
</style>
