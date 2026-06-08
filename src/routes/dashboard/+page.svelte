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

	const BAR_W = 100; // viewBox width unit basis
	const maxTopQty = $derived(Math.max(0, ...topItems.map((it) => it.qty)));

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

<div class="page flex flex-col gap-6 p-4 md:p-6">
	<header class="flex items-center justify-between gap-3">
		<h1 class="title">{t('dashboard.title')}</h1>
	</header>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<LoadingSpinner size="lg" />
		</div>
	{:else}
		<!-- KPI ROW -->
		<section class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<KpiCard
				icon="💰"
				label={t('dashboard.salesToday')}
				value={formatUsd(salesUsd)}
				sub={formatBs(salesBs)}
			/>
			<KpiCard icon="📦" label={t('dashboard.ordersToday')} value={String(orderCount)} />
			<KpiCard icon="🎯" label={t('dashboard.avgTicket')} value={formatUsd(avgTicket)} />
			<KpiCard icon="👥" label={t('dashboard.customersToday')} value={String(customersToday)} />
		</section>

		<!-- CHARTS -->
		<section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<!-- Sales by hour -->
			<Card>
				<h2 class="section-title mb-3">{t('dashboard.salesByHour')}</h2>
				{#if maxHourly <= 0}
					<p class="chart-empty">{t('dashboard.noData')}</p>
				{:else}
					<svg
						class="chart"
						viewBox="0 0 {BAR_W} 44"
						preserveAspectRatio="none"
						role="img"
						aria-label={t('dashboard.salesByHour')}
					>
						{#each hourSpan as bucket, i (bucket.hour)}
							{@const slot = BAR_W / hourSpan.length}
							{@const barW = slot * 0.7}
							{@const x = i * slot + (slot - barW) / 2}
							{@const h = maxHourly > 0 ? (bucket.value / maxHourly) * 36 : 0}
							<rect {x} y={40 - h} width={barW} height={h} rx="0.6" class="bar">
								<title>{pad2(bucket.hour)}:00 — {formatUsd(bucket.value)}</title>
							</rect>
						{/each}
					</svg>
					<div class="hour-labels flex justify-between mt-1">
						<span class="axis tabular-nums">{pad2(firstHour)}:00</span>
						{#if lastHour !== firstHour}
							<span class="axis tabular-nums">{pad2(lastHour)}:00</span>
						{/if}
					</div>
				{/if}
			</Card>

			<!-- Top items -->
			<Card>
				<h2 class="section-title mb-3">{t('dashboard.topItems')}</h2>
				{#if topItems.length === 0}
					<p class="chart-empty">{t('dashboard.noData')}</p>
				{:else}
					<ul class="flex flex-col gap-2.5">
						{#each topItems as item (item.name)}
							{@const ratio = maxTopQty > 0 ? item.qty / maxTopQty : 0}
							<li class="topitem">
								<div class="flex items-center justify-between gap-2 mb-1">
									<span class="topitem-name">{item.name}</span>
									<span class="topitem-qty tabular-nums"
										>{formatQty(item.qty)} {t('dashboard.units')}</span
									>
								</div>
								<div class="topbar-track">
									<div class="topbar-fill" style:width="{ratio * 100}%"></div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</Card>
		</section>

		<!-- ACTIVE SHIFT -->
		<section>
			{#if shiftStore.active}
				<Card>
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div class="flex flex-col gap-2">
							<div class="flex items-center gap-2">
								<h2 class="section-title">{t('dashboard.activeShift')}</h2>
								<Badge variant="success">#{shiftStore.active.shift_number}</Badge>
							</div>
							<div class="shift-meta flex flex-wrap gap-x-6 gap-y-1">
								<span
									>{t('shifts.openedBy')}:
									<strong>{shiftStore.active.opened_by_name ?? '—'}</strong></span
								>
								<span
									>{t('shifts.duration')}:
									<strong class="tabular-nums">{formatDuration(shiftStore.active.opened_at)}</strong
									></span
								>
								<span
									>{t('dashboard.ordersToday')}:
									<strong class="tabular-nums">{shiftStore.active.confirmed_orders}</strong></span
								>
								<span
									>{t('shifts.salesTotal')}:
									<strong class="tabular-nums"
										>{formatUsd(shiftStore.active.total_sales_usd)}</strong
									></span
								>
							</div>
						</div>
						<Button variant="danger" onclick={() => goto(resolve('/shifts'))}>
							{t('shifts.close')}
						</Button>
					</div>
				</Card>
			{:else}
				<Card>
					<div class="flex flex-wrap items-center justify-between gap-4">
						<div class="flex flex-col gap-1">
							<h2 class="section-title">{t('shifts.noActive')}</h2>
							<p class="muted">{t('shifts.noActivePrompt')}</p>
						</div>
						<Button variant="primary" onclick={() => goto(resolve('/shifts'))}>
							{t('shifts.open')}
						</Button>
					</div>
				</Card>
			{/if}
		</section>

		<!-- LOW STOCK -->
		<section class="flex flex-col gap-3">
			<div class="flex items-center gap-2">
				<h2 class="section-title">{t('dashboard.lowStock')}</h2>
				{#if lowStock.length > 0}
					<Badge variant="danger">{lowStock.length}</Badge>
				{/if}
			</div>

			{#if lowStock.length === 0}
				<Card>
					<EmptyState icon="✅" title={t('dashboard.noLowStock')} />
				</Card>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each lowStock as ing (ing.id)}
						<div class="alert-card">
							<div class="flex items-start justify-between gap-3 mb-3">
								<div class="flex flex-col gap-1 min-w-0">
									<span class="ing-name">{ing.name}</span>
									<Badge variant={ing.is_out_of_stock ? 'danger' : 'warning'}>
										{ing.is_out_of_stock ? t('ingredients.outOfStock') : t('ingredients.lowStock')}
									</Badge>
								</div>
								<Button size="sm" variant="primary" onclick={() => openRestock(ing)}>
									{t('dashboard.quickRestock')}
								</Button>
							</div>
							<StockBar current={ing.current_stock} min={ing.min_stock} unit={ing.unit} />
							<p class="ing-min tabular-nums mt-2">
								{t('ingredients.minStock')}: {formatQty(ing.min_stock, ing.unit)}
							</p>
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
		font-family: var(--font-sans);
	}

	.title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.section-title {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.muted {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
	}

	/* Charts */
	.chart {
		width: 100%;
		height: 140px;
		display: block;
	}

	.bar {
		fill: var(--color-accent);
		transition: fill 150ms ease;
	}

	.bar:hover {
		fill: var(--color-accent-hover);
	}

	.chart-empty {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		padding: 2rem 0;
		text-align: center;
	}

	.axis {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}

	/* Top items horizontal bars */
	.topitem-name {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.topitem-qty {
		font-size: 0.875rem;
		font-family: var(--font-mono);
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.topbar-track {
		height: 10px;
		width: 100%;
		background: var(--color-surface-overlay);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.topbar-fill {
		height: 100%;
		background: var(--color-secondary);
		border-radius: var(--radius-full);
		transition: width 150ms ease;
	}

	/* Shift meta */
	.shift-meta {
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
	}

	.shift-meta strong {
		color: var(--color-text-primary);
		font-weight: 700;
	}

	/* Low-stock alert cards */
	.alert-card {
		background: var(--color-surface-raised);
		border-radius: var(--radius-lg);
		border-left: 4px solid var(--color-danger);
		padding: 16px;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.ing-name {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ing-min {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
</style>
