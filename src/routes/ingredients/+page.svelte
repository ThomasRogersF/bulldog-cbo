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
	import Icon from '$lib/components/Icon.svelte';
	import ExportButton from '$lib/components/ExportButton.svelte';
	import { dateFilename } from '$lib/utils/export';
	import DateRangeFilter from '$lib/components/DateRangeFilter.svelte';
	import { rangeFromPreset, isInRange, rangeLabel, type DateRange } from '$lib/utils/dateRange';

	// 'low' = critical/out (red), 'mid' = low (amber), 'ok' = healthy (green)
	function levelOf(it: IngredientStock): 'low' | 'mid' | 'ok' {
		if (it.is_out_of_stock) return 'low';
		if (it.is_low_stock) return 'mid';
		return 'ok';
	}

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

	const lowCount = $derived(items.filter((it) => it.is_out_of_stock).length);

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
	let movementsDateRange = $state<DateRange>(rangeFromPreset('week'));

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
			if (!isInRange(m.created_at, movementsDateRange)) return false;
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

	function getStockExportOptions() {
		const rows = filteredItems.map((i) => ({
			nombre: i.name,
			categoria: i.category_name ?? '',
			stock_actual: i.current_stock,
			unidad: t('units.' + i.unit),
			stock_minimo: i.min_stock,
			estado: i.is_out_of_stock ? 'Agotado' : i.is_low_stock ? 'Bajo' : 'OK'
		}));
		return {
			filename: dateFilename('inventario'),
			title: 'Reporte de Inventario',
			subtitle: `${rows.length} ingredientes`,
			columns: [
				{ key: 'nombre', label: 'Ingrediente' },
				{ key: 'categoria', label: 'Categoría' },
				{ key: 'stock_actual', label: 'Stock' },
				{ key: 'unidad', label: 'Unidad' },
				{ key: 'stock_minimo', label: 'Mínimo' },
				{ key: 'estado', label: 'Estado' }
			],
			rows
		};
	}

	function getMovementsExportOptions() {
		const rows = filteredMovements.map((m) => ({
			fecha: new Date(m.created_at).toLocaleString('es-VE'),
			ingrediente: m.ingredient_name ?? '',
			cantidad: m.qty_change,
			razon: t('ingredientReason.' + m.reason),
			actor: m.actor_name ?? '',
			nota: m.note ?? ''
		}));
		return {
			filename: dateFilename('movimientos-inventario'),
			title: 'Movimientos de Inventario',
			subtitle: `${rows.length} movimientos · ${rangeLabel(movementsDateRange)}`,
			columns: [
				{ key: 'fecha', label: 'Fecha' },
				{ key: 'ingrediente', label: 'Ingrediente' },
				{ key: 'cantidad', label: 'Cantidad' },
				{ key: 'razon', label: 'Razón' },
				{ key: 'actor', label: 'Trabajador' },
				{ key: 'nota', label: 'Nota' }
			],
			rows
		};
	}

	const getIngExportOptions = $derived(
		tab === 'stock' ? getStockExportOptions : getMovementsExportOptions
	);

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

<div class="page">
	<!-- Segmented control + alert + export -->
	<div class="ing-top">
		<div class="segmented" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'stock'}
				class="seg"
				class:seg--on={tab === 'stock'}
				onclick={() => (tab = 'stock')}
			>
				<Icon name="box" size={17} />
				{t('ingredients.tabStock')}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'movements'}
				class="seg"
				class:seg--on={tab === 'movements'}
				onclick={() => (tab = 'movements')}
			>
				<Icon name="swap" size={17} />
				{t('ingredients.tabMovements')}
			</button>
		</div>
		<div class="ing-top-right">
			{#if tab === 'stock' && lowCount > 0}
				<div class="ing-alert">
					<Icon name="alert" size={16} />
					<b>{lowCount}</b>
					{t('ingredients.outOfStock')}
				</div>
			{/if}
			{#if tab === 'movements'}
				<DateRangeFilter value={movementsDateRange} onChange={(r) => (movementsDateRange = r)} />
			{/if}
			<ExportButton getExportOptions={getIngExportOptions} />
		</div>
	</div>

	{#if tab === 'stock'}
		<!-- Category filter pills -->
		<div class="tabs">
			<button
				type="button"
				class="pill"
				class:pill--on={activeCategory === 'all'}
				onclick={() => (activeCategory = 'all')}
			>
				{t('common.all')}
			</button>
			{#each categories as cat (cat.id)}
				<button
					type="button"
					class="pill"
					class:pill--on={activeCategory === cat.id}
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
			<EmptyState icon="box" title={t('ingredients.noIngredients')} />
		{:else}
			<div class="inggrid">
				{#each filteredItems as item (item.id)}
					{@const level = levelOf(item)}
					<div class="ing ing--{level}">
						<div class="ing__head">
							<div class="ing__id">
								<h4 class="ing__name">{item.name}</h4>
								<div class="ing__tags">
									<span class="chip chip--unit">{t('units.' + item.unit)}</span>
								</div>
							</div>
							<div class="ing__qty tabular-nums">
								{formatQty(item.current_stock)}<span>{t('units.' + item.unit)}</span>
							</div>
						</div>

						<div class="ing__barwrap">
							<StockBar
								current={item.current_stock}
								min={item.min_stock}
								unit={item.unit}
								showValue={false}
							/>
							<div class="ing__meta">
								<span class="ing__pct"
									>{t('ingredients.minStock')}:
									<b class="tabular-nums">{formatQty(item.min_stock, item.unit)}</b></span
								>
								<Badge
									variant={level === 'low' ? 'danger' : level === 'mid' ? 'warning' : 'success'}
								>
									{level === 'low'
										? t('ingredients.outOfStock')
										: level === 'mid'
											? t('ingredients.lowStock')
											: t('status.confirmed')}
								</Badge>
							</div>
						</div>

						<div class="ing__btns">
							<Button
								variant="primary"
								size="sm"
								icon="refill"
								full
								onclick={() => openRestock(item)}
							>
								{t('ingredients.restock')}
							</Button>
							<Button
								variant="secondary"
								size="sm"
								icon="edit"
								full
								onclick={() => openAdjust(item)}
							>
								{t('ingredients.adjust')}
							</Button>
						</div>
					</div>
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
			<EmptyState icon="receipt" title={t('ingredients.noMovements')} />
		{:else}
			<Card>
				<div class="moves__list">
					{#each filteredMovements as mv (mv.id)}
						{@const dir = mv.qty_change >= 0 ? 'in' : 'out'}
						<div class="move">
							<span class="move__ic move__ic--{dir}">
								<Icon name={dir === 'in' ? 'arrowDown' : 'arrowUp'} size={15} stroke={2.6} />
							</span>
							<div class="move__info">
								<div class="move__top">
									<span class="move__name">{mv.ingredient_name ?? '—'}</span>
									<Badge variant={reasonVariant(mv.reason)}>
										{t('ingredientReason.' + mv.reason)}
									</Badge>
								</div>
								<span class="move__who">
									{mv.actor_name ? mv.actor_name + ' · ' : ''}{formatDateTime(mv.created_at)}
								</span>
								{#if mv.note}<span class="move__note">{mv.note}</span>{/if}
							</div>
							<span class="move__delta move__delta--{dir}">
								{mv.qty_change > 0 ? '+' : ''}{formatQty(mv.qty_change, mv.ingredient_unit)}
							</span>
						</div>
					{/each}
				</div>
			</Card>
		{/if}
	{/if}
</div>

<!-- FAB: add ingredient (stock tab only) -->
{#if tab === 'stock'}
	<button type="button" class="fab" aria-label={t('ingredients.add')} onclick={openAdd}>
		<Icon name="plus" size={24} stroke={2.6} />
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
	.page {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px 26px 90px;
		font-family: var(--font-sans);
	}

	.ing-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
	}

	.ing-top-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	/* Segmented control */
	.segmented {
		display: inline-flex;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line);
		border-radius: 12px;
		padding: 5px;
		gap: 4px;
	}
	.seg {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 11px 26px;
		border: none;
		background: transparent;
		border-radius: 9px;
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 14px;
		color: var(--color-text-dim);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}
	.seg:hover {
		color: var(--color-text);
	}
	.seg--on {
		background: var(--color-mustard);
		color: var(--color-accent-fg);
	}

	.ing-alert {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-red);
		background: color-mix(in srgb, var(--color-red) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-red) 22%, transparent);
		padding: 10px 14px;
		border-radius: 11px;
	}
	.ing-alert b {
		font-weight: 800;
	}

	/* Category pills */
	.tabs {
		display: flex;
		gap: 9px;
		flex-wrap: wrap;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		min-height: 48px;
		padding: 9px 16px;
		border: 1px solid var(--color-line);
		background: var(--color-surface-2);
		border-radius: 9999px;
		font-family: var(--font-sans);
		font-size: 13.5px;
		font-weight: 700;
		color: var(--color-text-dim);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease,
			border-color 150ms ease;
	}
	.pill:hover {
		color: var(--color-text);
		border-color: var(--color-line-2);
	}
	.pill--on {
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		border-color: var(--color-mustard);
	}

	/* Ingredient cards */
	.inggrid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 14px;
	}
	.ing {
		display: flex;
		flex-direction: column;
		gap: 15px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-card);
		padding: 20px;
	}
	.ing--low {
		border-color: color-mix(in srgb, var(--color-red) 28%, transparent);
	}
	.ing--mid {
		border-color: color-mix(in srgb, var(--color-amber) 26%, transparent);
	}
	.ing__head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.ing__name {
		font-size: 16px;
		font-weight: 800;
		color: var(--color-text);
	}
	.ing__tags {
		display: flex;
		gap: 6px;
		margin-top: 8px;
	}
	.chip {
		font-size: 10.5px;
		font-weight: 600;
		color: var(--color-text-dim);
		background: var(--color-surface-2);
		border: 1px solid var(--color-line);
		padding: 3px 9px;
		border-radius: 7px;
	}
	.chip--unit {
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.ing__qty {
		font-size: 26px;
		font-weight: 800;
		color: var(--color-text);
		white-space: nowrap;
	}
	.ing__qty span {
		font-size: 14px;
		color: var(--color-text-dim);
		font-weight: 700;
		margin-left: 3px;
	}
	.ing__barwrap {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ing__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.ing__pct {
		font-size: 12.5px;
		color: var(--color-text-faint);
	}
	.ing__pct b {
		color: var(--color-text);
		font-weight: 700;
	}
	.ing__btns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	/* Movements */
	.moves__list {
		display: flex;
		flex-direction: column;
	}
	.move {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 14px 4px;
		border-bottom: 1px solid var(--color-line);
	}
	.move:last-child {
		border-bottom: none;
	}
	.move__ic {
		width: 32px;
		height: 32px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		flex: none;
	}
	.move__ic--in {
		background: color-mix(in srgb, var(--color-green) 14%, transparent);
		color: var(--color-green);
	}
	.move__ic--out {
		background: color-mix(in srgb, var(--color-amber) 14%, transparent);
		color: var(--color-amber);
	}
	.move__info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.move__top {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.move__name {
		font-weight: 700;
		font-size: 14px;
		color: var(--color-text);
	}
	.move__who {
		font-size: 11.5px;
		color: var(--color-text-faint);
	}
	.move__note {
		font-size: 11.5px;
		color: var(--color-text-dim);
	}
	.move__delta {
		font-weight: 800;
		font-size: 14px;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.move__delta--in {
		color: var(--color-green);
	}
	.move__delta--out {
		color: var(--color-text-dim);
	}

	/* Modal stat box */
	.modal-stat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line);
		border-radius: 11px;
	}
	.modal-stat-label {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--color-text-dim);
	}
	.modal-stat-value {
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	/* FAB */
	.fab {
		position: fixed;
		right: 20px;
		bottom: 88px;
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border: none;
		border-radius: var(--radius-full);
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		cursor: pointer;
		box-shadow: 0 12px 26px -8px color-mix(in srgb, var(--color-mustard) 70%, transparent);
		transition:
			filter 150ms ease,
			transform 150ms ease;
		z-index: 30;
	}
	.fab:hover {
		filter: brightness(1.06);
	}
	.fab:active {
		transform: scale(0.92);
	}

	@media (min-width: 1024px) {
		.fab {
			bottom: 24px;
		}
	}
	@media (max-width: 1024px) {
		.inggrid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 640px) {
		.page {
			padding: 18px 16px 90px;
		}
	}
</style>
