<script lang="ts">
	import { ingredientsDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/stores/toast.svelte';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';
	import { formatQty, formatDateTime } from '$lib/utils/format';
	import type {
		IngredientStock,
		IngredientCategory,
		IngredientLedgerEntry,
		LedgerReason,
		Unit
	} from '$lib/types';

	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import StockBar from '$lib/components/StockBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	type Tab = 'stock' | 'movements';
	let tab = $state<Tab>('stock');

	// ── Stock tab state ──────────────────────────────────────────────
	let categories = $state<IngredientCategory[]>([]);
	let items = $state<IngredientStock[]>([]);
	let stockLoading = $state(true);
	let activeCategory = $state<string>('all'); // 'all' or category id

	const filteredItems = $derived(
		activeCategory === 'all' ? items : items.filter((it) => it.category_id === activeCategory)
	);

	async function loadStock() {
		stockLoading = true;
		try {
			const [cats, list] = await Promise.all([
				ingredientsDb.categories.list(),
				ingredientsDb.items.list()
			]);
			categories = cats;
			items = list;
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			stockLoading = false;
		}
	}

	// ── Movements tab state ──────────────────────────────────────────
	let movements = $state<IngredientLedgerEntry[]>([]);
	let movementsLoading = $state(true);
	let filterIngredient = $state<string>('all');
	let filterReason = $state<string>('all');

	const REASONS: LedgerReason[] = [
		'sale',
		'restock',
		'adjustment',
		'waste',
		'manual_override',
		'opening_count'
	];

	const filteredMovements = $derived(
		movements.filter((m) => {
			if (filterIngredient !== 'all' && m.ingredient_id !== filterIngredient) return false;
			if (filterReason !== 'all' && m.reason !== filterReason) return false;
			return true;
		})
	);

	async function loadMovements() {
		movementsLoading = true;
		try {
			movements = await ingredientsDb.ledger.list({ limit: 100 });
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			movementsLoading = false;
		}
	}

	// Initial load + live refresh on ledger changes.
	$effect(() => {
		track(dataVersion.ledger);
		void loadStock();
		void loadMovements();
	});

	function reasonVariant(
		reason: LedgerReason
	): 'success' | 'danger' | 'warning' | 'info' | 'secondary' | 'neutral' {
		switch (reason) {
			case 'restock':
				return 'success';
			case 'sale':
				return 'info';
			case 'waste':
				return 'danger';
			case 'adjustment':
				return 'warning';
			case 'manual_override':
				return 'secondary';
			default:
				return 'neutral';
		}
	}

	// ── Restock modal ────────────────────────────────────────────────
	let restockOpen = $state(false);
	let restockTarget = $state<IngredientStock | null>(null);
	let restockQty = $state('');
	let restockNote = $state('');
	let restockSaving = $state(false);

	function openRestock(item: IngredientStock) {
		restockTarget = item;
		restockQty = '';
		restockNote = '';
		restockOpen = true;
	}

	async function submitRestock() {
		if (!restockTarget) return;
		const qty = Number(restockQty);
		if (!Number.isFinite(qty) || qty <= 0) {
			toast.error(t('validation.mustBePositive'));
			return;
		}
		restockSaving = true;
		try {
			await ingredientsDb.ledger.addMovement({
				ingredientId: restockTarget.id,
				qtyChange: qty,
				reason: 'restock',
				note: restockNote.trim() || null
			});
			toast.success(t('toasts.restockRegistered'));
			restockOpen = false;
			await loadStock();
			await loadMovements();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			restockSaving = false;
		}
	}

	// ── Adjust modal ─────────────────────────────────────────────────
	let adjustOpen = $state(false);
	let adjustTarget = $state<IngredientStock | null>(null);
	let adjustDelta = $state('');
	let adjustNote = $state('');
	let adjustSaving = $state(false);

	function openAdjust(item: IngredientStock) {
		adjustTarget = item;
		adjustDelta = '';
		adjustNote = '';
		adjustOpen = true;
	}

	async function submitAdjust() {
		if (!adjustTarget) return;
		const delta = Number(adjustDelta);
		if (!Number.isFinite(delta) || delta === 0) {
			toast.error(t('validation.invalidNumber'));
			return;
		}
		if (!adjustNote.trim()) {
			toast.error(t('validation.noteRequired'));
			return;
		}
		adjustSaving = true;
		try {
			await ingredientsDb.ledger.addMovement({
				ingredientId: adjustTarget.id,
				qtyChange: delta,
				reason: 'adjustment',
				note: adjustNote.trim()
			});
			toast.success(t('toasts.movementRegistered'));
			adjustOpen = false;
			await loadStock();
			await loadMovements();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			adjustSaving = false;
		}
	}

	// ── Add ingredient modal ─────────────────────────────────────────
	let addOpen = $state(false);
	let addName = $state('');
	let addCategory = $state('');
	let addUnit = $state<Unit>('unit');
	let addMinStock = $state('');
	let addOpeningCount = $state('');
	let addSaving = $state(false);

	const UNITS: Unit[] = ['unit', 'g', 'ml', 'kg', 'l'];

	function openAdd() {
		addName = '';
		addCategory = '';
		addUnit = 'unit';
		addMinStock = '';
		addOpeningCount = '';
		addOpen = true;
	}

	async function submitAdd() {
		if (!addName.trim()) {
			toast.error(t('validation.required'));
			return;
		}
		addSaving = true;
		try {
			await ingredientsDb.items.create({
				name: addName.trim(),
				category_id: addCategory || null,
				unit: addUnit,
				min_stock: addMinStock ? Number(addMinStock) : 0,
				openingCount: addOpeningCount ? Number(addOpeningCount) : 0
			});
			toast.success(t('ingredients.saved'));
			addOpen = false;
			await loadStock();
			await loadMovements();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			addSaving = false;
		}
	}
</script>

<div class="page flex flex-col gap-4 p-4 pb-24">
	<header class="flex items-center justify-between gap-3">
		<h1 class="title">{t('ingredients.title')}</h1>
	</header>

	<!-- Tabs -->
	<div class="tabs flex gap-1 p-1" role="tablist">
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'stock'}
			class="tab flex-1"
			class:active={tab === 'stock'}
			onclick={() => (tab = 'stock')}
		>
			{t('ingredients.tabStock')}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'movements'}
			class="tab flex-1"
			class:active={tab === 'movements'}
			onclick={() => (tab = 'movements')}
		>
			{t('ingredients.tabMovements')}
		</button>
	</div>

	{#if tab === 'stock'}
		<!-- Category filter pills -->
		<div class="pills flex gap-2 overflow-x-auto pb-1">
			<button
				type="button"
				class="pill"
				class:active={activeCategory === 'all'}
				onclick={() => (activeCategory = 'all')}
			>
				{t('common.all')}
			</button>
			{#each categories as cat (cat.id)}
				<button
					type="button"
					class="pill"
					class:active={activeCategory === cat.id}
					onclick={() => (activeCategory = cat.id)}
				>
					{cat.name}
				</button>
			{/each}
		</div>

		{#if stockLoading}
			<div class="flex justify-center p-8">
				<LoadingSpinner size="lg" />
			</div>
		{:else if filteredItems.length === 0}
			<EmptyState icon="🧺" title={t('ingredients.noIngredients')} />
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				{#each filteredItems as item (item.id)}
					<Card>
						<div class="flex flex-col gap-3">
							<div class="flex items-start justify-between gap-2">
								<div class="flex flex-col gap-1 min-w-0">
									<span class="item-name">{item.name}</span>
									<div class="flex items-center gap-2 flex-wrap">
										<Badge variant="neutral">{t('units.' + item.unit)}</Badge>
										{#if item.is_out_of_stock}
											<Badge variant="danger">{t('ingredients.outOfStock')}</Badge>
										{:else if item.is_low_stock}
											<Badge variant="warning">{t('ingredients.lowStock')}</Badge>
										{/if}
									</div>
								</div>
								<span class="current-stock tabular-nums">
									{formatQty(item.current_stock, item.unit)}
								</span>
							</div>

							<StockBar current={item.current_stock} min={item.min_stock} unit={item.unit} />

							<div class="grid grid-cols-2 gap-2">
								<Button variant="primary" size="sm" full onclick={() => openRestock(item)}>
									+ {t('ingredients.restock')}
								</Button>
								<Button variant="secondary" size="sm" full onclick={() => openAdjust(item)}>
									{t('ingredients.adjust')}
								</Button>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{:else}
		<!-- Movements tab -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
			<Select
				bind:value={filterIngredient}
				options={[
					{ value: 'all', label: t('ingredients.filterIngredient') },
					...items.map((it) => ({ value: it.id, label: it.name }))
				]}
			/>
			<Select
				bind:value={filterReason}
				options={[
					{ value: 'all', label: t('ingredients.allReasons') },
					...REASONS.map((r) => ({ value: r, label: t('ingredientReason.' + r) }))
				]}
			/>
		</div>

		{#if movementsLoading}
			<div class="flex justify-center p-8">
				<LoadingSpinner size="lg" />
			</div>
		{:else if filteredMovements.length === 0}
			<EmptyState icon="📋" title={t('ingredients.noMovements')} />
		{:else}
			<div class="flex flex-col gap-2">
				{#each filteredMovements as mv (mv.id)}
					<Card padding="sm">
						<div class="flex items-start justify-between gap-3">
							<div class="flex flex-col gap-1 min-w-0">
								<span class="mv-name">{mv.ingredient_name ?? '—'}</span>
								<div class="flex items-center gap-2 flex-wrap">
									<Badge variant={reasonVariant(mv.reason)}>
										{t('ingredientReason.' + mv.reason)}
									</Badge>
									{#if mv.actor_name}
										<span class="mv-meta">{mv.actor_name}</span>
									{/if}
								</div>
								{#if mv.note}
									<span class="mv-note">{mv.note}</span>
								{/if}
								<span class="mv-meta">{formatDateTime(mv.created_at)}</span>
							</div>
							<span
								class="mv-qty tabular-nums"
								class:pos={mv.qty_change > 0}
								class:neg={mv.qty_change < 0}
							>
								{mv.qty_change > 0 ? '+' : ''}{formatQty(mv.qty_change, mv.ingredient_unit)}
							</span>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- FAB: add ingredient (stock tab only) -->
{#if tab === 'stock'}
	<button type="button" class="fab" aria-label={t('ingredients.add')} onclick={openAdd}>
		<span aria-hidden="true">+</span>
	</button>
{/if}

<!-- Restock modal -->
<Modal bind:open={restockOpen} title={restockTarget?.name ?? t('ingredients.restockTitle')}>
	<div class="flex flex-col gap-4">
		{#if restockTarget}
			<div class="modal-stat">
				<span class="modal-stat-label">{t('ingredients.currentStock')}</span>
				<span class="modal-stat-value tabular-nums">
					{formatQty(restockTarget.current_stock, restockTarget.unit)}
				</span>
			</div>
		{/if}
		<Input
			label={t('ingredients.quantityAdd')}
			type="number"
			inputmode="decimal"
			bind:value={restockQty}
			placeholder="0"
		/>
		<Input
			label={t('ingredients.note')}
			bind:value={restockNote}
			placeholder={t('ingredients.notePlaceholder')}
			helper={t('common.optional')}
		/>
		<div class="flex gap-2">
			<Button variant="ghost" full onclick={() => (restockOpen = false)}>
				{t('common.cancel')}
			</Button>
			<Button variant="primary" full loading={restockSaving} onclick={submitRestock}>
				{t('ingredients.registerRestock')}
			</Button>
		</div>
	</div>
</Modal>

<!-- Adjust modal -->
<Modal bind:open={adjustOpen} title={adjustTarget?.name ?? t('ingredients.adjustTitle')}>
	<div class="flex flex-col gap-4">
		{#if adjustTarget}
			<div class="modal-stat">
				<span class="modal-stat-label">{t('ingredients.currentStock')}</span>
				<span class="modal-stat-value tabular-nums">
					{formatQty(adjustTarget.current_stock, adjustTarget.unit)}
				</span>
			</div>
		{/if}
		<Input
			label={t('ingredients.quantity')}
			type="number"
			inputmode="decimal"
			bind:value={adjustDelta}
			placeholder="0"
		/>
		<Input
			label={t('ingredients.note')}
			bind:value={adjustNote}
			placeholder={t('ingredients.notePlaceholder')}
			helper={t('common.required')}
		/>
		<div class="flex gap-2">
			<Button variant="ghost" full onclick={() => (adjustOpen = false)}>
				{t('common.cancel')}
			</Button>
			<Button variant="primary" full loading={adjustSaving} onclick={submitAdjust}>
				{t('ingredients.registerMovement')}
			</Button>
		</div>
	</div>
</Modal>

<!-- Add ingredient modal -->
<Modal bind:open={addOpen} title={t('ingredients.add')}>
	<div class="flex flex-col gap-4">
		<Input label={t('ingredients.name')} bind:value={addName} />
		<Select
			label={t('ingredients.category')}
			bind:value={addCategory}
			placeholder={t('common.none')}
			options={categories.map((c) => ({ value: c.id, label: c.name }))}
		/>
		<Select
			label={t('ingredients.unit')}
			bind:value={addUnit}
			options={UNITS.map((u) => ({ value: u, label: t('units.' + u) }))}
		/>
		<Input
			label={t('ingredients.minStock')}
			type="number"
			inputmode="decimal"
			bind:value={addMinStock}
			placeholder="0"
		/>
		<Input
			label={t('ingredients.openingCount')}
			type="number"
			inputmode="decimal"
			bind:value={addOpeningCount}
			placeholder="0"
			helper={t('common.optional')}
		/>
		<div class="flex gap-2">
			<Button variant="ghost" full onclick={() => (addOpen = false)}>
				{t('common.cancel')}
			</Button>
			<Button variant="primary" full loading={addSaving} onclick={submitAdd}>
				{t('common.save')}
			</Button>
		</div>
	</div>
</Modal>

<style>
	.title {
		font-family: var(--font-sans);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.tabs {
		background: var(--color-surface-overlay);
		border-radius: var(--radius-lg);
	}

	.tab {
		min-height: 48px;
		padding: 0 16px;
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.tab.active {
		background: var(--color-surface-raised);
		color: var(--color-text-primary);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.pill {
		flex-shrink: 0;
		min-height: 48px;
		padding: 0 16px;
		border: 1px solid var(--color-surface-overlay);
		background: var(--color-surface-raised);
		border-radius: var(--radius-full);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease,
			border-color 150ms ease,
			transform 150ms ease;
	}

	.pill:active {
		transform: scale(0.96);
	}

	.pill.active {
		background: var(--color-accent);
		color: var(--color-accent-fg);
		border-color: var(--color-accent);
	}

	.item-name {
		font-family: var(--font-sans);
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.current-stock {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.mv-name {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mv-meta {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.mv-note {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.mv-qty {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text-secondary);
	}

	.mv-qty.pos {
		color: var(--color-success);
	}

	.mv-qty.neg {
		color: var(--color-danger);
	}

	.modal-stat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		background: var(--color-surface-base);
		border-radius: var(--radius-md);
	}

	.modal-stat-label {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.modal-stat-value {
		font-family: var(--font-mono);
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.fab {
		position: fixed;
		right: 20px;
		bottom: 88px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border: none;
		border-radius: var(--radius-full);
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.12),
			0 4px 8px rgba(0, 0, 0, 0.08);
		transition:
			background 150ms ease,
			transform 150ms ease;
		z-index: 30;
	}

	.fab:hover {
		background: var(--color-accent-hover);
	}

	.fab:active {
		transform: scale(0.92);
	}

	@media (min-width: 768px) {
		.fab {
			bottom: 24px;
		}
	}
</style>
