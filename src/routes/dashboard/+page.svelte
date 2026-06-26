<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { ordersDb, ingredientsDb } from '$lib/db';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';
	import { shiftStore } from '$lib/stores/shift.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { formatUsd, formatBs, formatQty, formatDuration } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import type { Order, IngredientStock } from '$lib/types';

	import KpiCard from '$lib/components/KpiCard.svelte';
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import StockBar from '$lib/components/StockBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	// ── Local state ─────────────────────────────────────────────────────────
	let loading = $state(true);
	let todayOrders = $state<Order[]>([]);
	let lowStock = $state<IngredientStock[]>([]);
	let hourlySales = $state<number[]>(new Array(24).fill(0));
	let topItems = $state<{ name: string; qty: number }[]>([]);

	// Quick-restock modal
	let restockOpen = $state(false);
	let restockTarget = $state<IngredientStock | null>(null);
	let restockQty = $state('');
	let restockSaving = $state(false);

	// ── Helpers ─────────────────────────────────────────────────────────────
	function isToday(iso: string): boolean {
		const d = new Date(iso);
		const now = new Date();
		return (
			d.getFullYear() === now.getFullYear() &&
			d.getMonth() === now.getMonth() &&
			d.getDate() === now.getDate()
		);
	}

	async function load(): Promise<void> {
		loading = true;
		try {
			const [orders, low] = await Promise.all([
				ordersDb.list({ limit: 500 }),
				ingredientsDb.stock.getLowStock()
			]);

			const confirmedToday = orders.filter(
				(o) => o.status === 'confirmed' && isToday(o.created_at)
			);
			todayOrders = confirmedToday;
			lowStock = low;

			// Sales-by-hour buckets (0–23)
			const buckets = new Array(24).fill(0);
			for (const o of confirmedToday) {
				const h = new Date(o.created_at).getHours();
				buckets[h] += o.total_usd;
			}
			hourlySales = buckets;

			// Top items: fetch each order's items, aggregate by snapshot name
			const detailed = await Promise.all(confirmedToday.map((o) => ordersDb.getById(o.id)));
			const tally = new SvelteMap<string, number>();
			for (const order of detailed) {
				if (!order) continue;
				for (const item of order.items) {
					const name = item.menu_item_snapshot.name || '—';
					tally.set(name, (tally.get(name) ?? 0) + item.qty);
				}
			}
			topItems = [...tally.entries()]
				.map(([name, qty]) => ({ name, qty }))
				.sort((a, b) => b.qty - a.qty)
				.slice(0, 5);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t('toasts.loadFailed'));
		} finally {
			loading = false;
		}
	}

	// Initial load + live refresh when orders/stock change via realtime.
	$effect(() => {
		track(dataVersion.orders, dataVersion.ledger);
		void load();
	});

	// ── Derived KPI values ──────────────────────────────────────────────────
	const salesUsd = $derived(todayOrders.reduce((s, o) => s + o.total_usd, 0));
	const salesBs = $derived(todayOrders.reduce((s, o) => s + (o.total_bs ?? 0), 0));
	const orderCount = $derived(todayOrders.length);
	const avgTicket = $derived(orderCount > 0 ? salesUsd / orderCount : 0);
	const customersToday = $derived(
		new SvelteSet(todayOrders.map((o) => o.customer_id).filter((id): id is string => !!id)).size
	);

	// ── Chart math (guarded against divide-by-zero) ─────────────────────────
	// Sales-by-hour: only render the span of hours with activity for clarity.
	const activeHours = $derived(
		hourlySales.reduce<number[]>((acc, v, i) => {
			if (v > 0) acc.push(i);
			return acc;
		}, [])
	);
	const firstHour = $derived(activeHours.length ? activeHours[0] : 0);
	const lastHour = $derived(activeHours.length ? activeHours[activeHours.length - 1] : 0);
	const hourSpan = $derived(
		Array.from({ length: lastHour - firstHour + 1 }, (_, i) => ({
			hour: firstHour + i,
			value: hourlySales[firstHour + i]
		}))
	);
	const maxHourly = $derived(Math.max(0, ...hourlySales));

	const maxTopQty = $derived(Math.max(0, ...topItems.map((it) => it.qty)));

	// Peak hour (for the highlighted bar) + chart total.
	const peakIndex = $derived(
		hourSpan.reduce((best, b, i, arr) => (b.value > arr[best].value ? i : best), 0)
	);
	const yTicks = [1, 0.75, 0.5, 0.25, 0];
	function compactUsd(n: number): string {
		return formatUsd(n).replace(/[.,]00$/, '');
	}

	// ── Quick restock ───────────────────────────────────────────────────────
	function openRestock(item: IngredientStock): void {
		restockTarget = item;
		restockQty = '';
		restockOpen = true;
	}

	async function submitRestock(): Promise<void> {
		const target = restockTarget;
		if (!target) return;
		const qty = Number(restockQty);
		if (!Number.isFinite(qty) || qty <= 0) {
			toast.error(t('validation.mustBePositive'));
			return;
		}
		restockSaving = true;
		try {
			await ingredientsDb.ledger.addMovement({
				ingredientId: target.id,
				qtyChange: qty,
				reason: 'restock'
			});
			toast.success(t('toasts.restockRegistered'));
			restockOpen = false;
			restockTarget = null;
			await load();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t('toasts.saveFailed'));
		} finally {
			restockSaving = false;
		}
	}

	function pad2(n: number): string {
		return String(n).padStart(2, '0');
	}
</script>

<div class="page">
	{#if loading}
		<div class="flex items-center justify-center py-16">
			<LoadingSpinner size="lg" />
		</div>
	{:else}
		<!-- KPI ROW -->
		<section class="kpi-row">
			<KpiCard
				icon="cash"
				label={t('dashboard.salesToday')}
				value={formatUsd(salesUsd)}
				sub={formatBs(salesBs)}
			/>
			<KpiCard icon="bag" label={t('dashboard.ordersToday')} value={String(orderCount)} />
			<KpiCard icon="tag" label={t('dashboard.avgTicket')} value={formatUsd(avgTicket)} />
			<KpiCard icon="users" label={t('dashboard.customersToday')} value={String(customersToday)} />
		</section>

		<!-- CHARTS -->
		<section class="panel-mid">
			<!-- Sales by hour -->
			<Card>
				<div class="card__head">
					<h2 class="card__title">{t('dashboard.salesByHour')}</h2>
					<div class="chart__total">
						<span class="chart__total-num tabular-nums">{formatUsd(salesUsd)}</span>
						<span class="chart__total-bs tabular-nums">{formatBs(salesBs)}</span>
					</div>
				</div>
				{#if maxHourly <= 0}
					<p class="chart-empty">{t('dashboard.noData')}</p>
				{:else}
					<div class="chart__plot">
						<div class="chart__ylabels">
							{#each yTicks as g (g)}
								<span>{compactUsd(maxHourly * g)}</span>
							{/each}
						</div>
						<div class="chart__lines"></div>
						<div class="chart__bars">
							{#each hourSpan as bucket, i (bucket.hour)}
								<div class="barcol">
									<div class="barslot">
										<span class="barval tabular-nums" style:opacity={i === peakIndex ? 1 : 0.5}>
											{compactUsd(bucket.value)}
										</span>
										<div
											class="bar"
											class:bar--peak={i === peakIndex}
											style:height="{Math.max((bucket.value / maxHourly) * 90, 2)}%"
										></div>
									</div>
									<span class="barlbl tabular-nums">{pad2(bucket.hour)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</Card>

			<!-- Top items -->
			<Card>
				<div class="card__head">
					<h2 class="card__title">{t('dashboard.topItems')}</h2>
					<Badge variant="secondary" icon="crown">{t('dashboard.topItems')}</Badge>
				</div>
				{#if topItems.length === 0}
					<p class="chart-empty">{t('dashboard.noData')}</p>
				{:else}
					<div class="toplist">
						{#each topItems as item, i (item.name)}
							{@const ratio = maxTopQty > 0 ? item.qty / maxTopQty : 0}
							<div class="toprow">
								<span class="rank" class:rank--gold={i === 0}>{i + 1}</span>
								<div class="toprow__main">
									<div class="toprow__head">
										<span class="toprow__name">{item.name}</span>
										<span class="toprow__units tabular-nums"
											>{formatQty(item.qty)} <i>{t('dashboard.units')}</i></span
										>
									</div>
									<div class="track">
										<div class="track__fill" style:width="{ratio * 100}%"></div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Card>
		</section>

		<!-- ACTIVE SHIFT -->
		<section>
			{#if shiftStore.active}
				<Card>
					<div class="shiftcard">
						<div class="shiftcard__main">
							<div class="shiftcard__title">
								<span class="dot-live"></span>
								<h2 class="card__title">{t('dashboard.activeShift')}</h2>
								<Badge variant="secondary">#{shiftStore.active.shift_number}</Badge>
							</div>
							<div class="shiftcard__stats">
								<div class="sstat">
									<span class="sstat__l">{t('shifts.openedBy')}</span>
									<span class="sstat__v">{shiftStore.active.opened_by_name ?? '—'}</span>
								</div>
								<div class="sstat">
									<span class="sstat__l">{t('shifts.duration')}</span>
									<span class="sstat__v tabular-nums"
										>{formatDuration(shiftStore.active.opened_at)}</span
									>
								</div>
								<div class="sstat">
									<span class="sstat__l">{t('dashboard.ordersToday')}</span>
									<span class="sstat__v tabular-nums">{shiftStore.active.confirmed_orders}</span>
								</div>
								<div class="sstat">
									<span class="sstat__l">{t('shifts.salesTotal')}</span>
									<span class="sstat__v sstat__v--hi tabular-nums"
										>{formatUsd(shiftStore.active.total_sales_usd)}</span
									>
								</div>
							</div>
						</div>
						<Button variant="danger" icon="x" onclick={() => goto(resolve('/shifts'))}>
							{t('shifts.close')}
						</Button>
					</div>
				</Card>
			{:else}
				<Card>
					<div class="flex flex-wrap items-center justify-between gap-4">
						<div class="flex flex-col gap-1">
							<h2 class="card__title">{t('shifts.noActive')}</h2>
							<p class="muted">{t('shifts.noActivePrompt')}</p>
						</div>
						<Button variant="primary" icon="clock" onclick={() => goto(resolve('/shifts'))}>
							{t('shifts.open')}
						</Button>
					</div>
				</Card>
			{/if}
		</section>

		<!-- LOW STOCK -->
		<section class="flex flex-col gap-3">
			<div class="lowstock__title">
				<h2 class="card__title">{t('dashboard.lowStock')}</h2>
				{#if lowStock.length > 0}
					<Badge variant="danger">{lowStock.length}</Badge>
				{/if}
			</div>

			{#if lowStock.length === 0}
				<Card>
					<EmptyState icon="checkcircle" title={t('dashboard.noLowStock')} />
				</Card>
			{:else}
				<div class="lowgrid">
					{#each lowStock as ing (ing.id)}
						<div class="lowitem lowitem--{ing.is_out_of_stock ? 'low' : 'mid'}">
							<div class="lowitem__top">
								<span class="lowitem__name">{ing.name}</span>
								<Badge variant={ing.is_out_of_stock ? 'danger' : 'warning'}>
									{ing.is_out_of_stock ? t('ingredients.outOfStock') : t('ingredients.lowStock')}
								</Badge>
							</div>
							<div class="lowitem__qty tabular-nums">{formatQty(ing.current_stock, ing.unit)}</div>
							<StockBar
								current={ing.current_stock ?? 0}
								min={ing.min_stock}
								unit={ing.unit}
								showValue={false}
							/>
							<p class="lowitem__min tabular-nums">
								{t('ingredients.minStock')}: {formatQty(ing.min_stock, ing.unit)}
							</p>
							<Button
								size="sm"
								variant="secondary"
								icon="refill"
								full
								onclick={() => openRestock(ing)}
							>
								{t('ingredients.restock')}
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<!-- QUICK RESTOCK MODAL -->
<Modal bind:open={restockOpen} title={t('ingredients.restockTitle')}>
	<div class="flex flex-col gap-4">
		{#if restockTarget}
			<p class="muted">{restockTarget.name}</p>
		{/if}
		<Input
			label={t('ingredients.quantityAdd')}
			bind:value={restockQty}
			type="number"
			inputmode="decimal"
			placeholder="0"
		/>
		<div class="flex gap-2 justify-end">
			<Button variant="ghost" onclick={() => (restockOpen = false)}>
				{t('common.cancel')}
			</Button>
			<Button variant="primary" loading={restockSaving} onclick={submitRestock}>
				{t('ingredients.registerRestock')}
			</Button>
		</div>
	</div>
</Modal>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;
		padding: 24px 26px 44px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		font-family: var(--font-sans);
	}

	.card__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
	}

	.card__title {
		font-size: 16px;
		font-weight: 800;
		color: var(--color-text);
		white-space: nowrap;
	}

	.muted {
		color: var(--color-text-faint);
		font-size: 0.9375rem;
	}

	.chart-empty {
		color: var(--color-text-faint);
		font-size: 0.9375rem;
		padding: 2rem 0;
		text-align: center;
	}

	/* KPI + layout grids */
	.kpi-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}

	.panel-mid {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 16px;
	}

	/* Bar chart */
	.chart__total {
		text-align: right;
	}
	.chart__total-num {
		font-size: 20px;
		font-weight: 800;
		display: block;
		color: var(--color-text);
	}
	.chart__total-bs {
		font-size: 11.5px;
		color: var(--color-text-faint);
	}
	.chart__plot {
		position: relative;
		padding-left: 52px;
	}
	.chart__ylabels {
		position: absolute;
		left: 0;
		top: 0;
		width: 44px;
		height: 210px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		text-align: right;
		font-size: 10.5px;
		color: var(--color-text-faint);
	}
	.chart__lines {
		position: absolute;
		left: 52px;
		right: 0;
		top: 0;
		height: 210px;
		pointer-events: none;
		background: repeating-linear-gradient(to top, var(--color-line) 0 1px, transparent 1px 52.5px);
	}
	.chart__bars {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 12px;
	}
	.barcol {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.barslot {
		height: 210px;
		width: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		gap: 6px;
	}
	.barval {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-text);
	}
	.bar {
		width: 100%;
		max-width: 38px;
		min-height: 6px;
		border-radius: 7px 7px 2px 2px;
		background: linear-gradient(180deg, var(--color-mustard), var(--color-mustard-deep));
		transition: 0.25s;
	}
	.bar--peak {
		box-shadow: 0 0 22px -4px color-mix(in srgb, var(--color-mustard) 50%, transparent);
	}
	.barlbl {
		font-size: 11px;
		color: var(--color-text-faint);
		font-weight: 600;
	}

	/* Top products */
	.toplist {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	.toprow {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 12px;
		align-items: center;
	}
	.rank {
		width: 26px;
		height: 26px;
		border-radius: 8px;
		background: var(--color-surface-2);
		color: var(--color-text-dim);
		font-weight: 800;
		font-size: 13px;
		display: grid;
		place-items: center;
		flex: none;
	}
	.rank--gold {
		background: var(--color-mustard);
		color: var(--color-accent-fg);
	}
	.toprow__main {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.toprow__head {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
	.toprow__name {
		font-weight: 700;
		font-size: 14px;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.toprow__units {
		font-size: 13px;
		color: var(--color-text);
		font-weight: 700;
		white-space: nowrap;
	}
	.toprow__units i {
		color: var(--color-text-faint);
		font-style: normal;
		font-size: 11px;
		font-weight: 600;
	}
	.track {
		height: 8px;
		background: var(--color-surface-3);
		border-radius: 9999px;
		overflow: hidden;
	}
	.track__fill {
		height: 100%;
		background: var(--color-mustard);
		border-radius: 9999px;
		transition: width 0.3s;
	}

	/* Active shift card */
	.shiftcard {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
	}
	.shiftcard__main {
		flex: 1;
		min-width: 0;
	}
	.shiftcard__title {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.shiftcard__stats {
		display: flex;
		gap: 34px;
		flex-wrap: wrap;
	}
	.sstat {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sstat__l {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-faint);
		font-weight: 600;
	}
	.sstat__v {
		font-size: 15px;
		font-weight: 700;
		color: var(--color-text);
	}
	.sstat__v--hi {
		color: var(--color-mustard);
		font-weight: 800;
	}

	/* Low stock */
	.lowstock__title {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.lowgrid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}
	.lowitem {
		background: var(--color-surface-2);
		border: 1px solid var(--color-line);
		border-radius: 14px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 11px;
	}
	.lowitem--low {
		border-color: color-mix(in srgb, var(--color-red) 30%, transparent);
	}
	.lowitem--mid {
		border-color: color-mix(in srgb, var(--color-amber) 26%, transparent);
	}
	.lowitem__top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.lowitem__name {
		font-weight: 700;
		font-size: 13.5px;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lowitem__qty {
		font-size: 22px;
		font-weight: 800;
		color: var(--color-text);
	}
	.lowitem__min {
		font-size: 11.5px;
		color: var(--color-text-faint);
	}

	@media (max-width: 1240px) {
		.panel-mid {
			grid-template-columns: 1fr;
		}
		.lowgrid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 1100px) {
		.kpi-row {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 640px) {
		.page {
			/* Bottom nav clearance is owned by the layout's `.content` (pb-20); keep only
			   normal page spacing here so the two don't stack into excess whitespace. */
			padding: 18px 16px 24px;
		}
		.kpi-row {
			grid-template-columns: 1fr 1fr;
		}
		.lowgrid {
			grid-template-columns: 1fr;
		}
	}
</style>
