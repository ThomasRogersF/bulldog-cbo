<script lang="ts">
	import type { Order, OrderWithItems, PaymentMethod, OrderStatus } from '$lib/types';
	import { SvelteSet } from 'svelte/reactivity';
	import { ordersDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import { formatUsd, timeAgo, formatDateTime } from '$lib/utils/format';
	import { toast } from '$lib/stores/toast.svelte';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';

	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Select from '$lib/components/Select.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import OrderCard from '$lib/components/OrderCard.svelte';
	import ExportButton from '$lib/components/ExportButton.svelte';
	import { dateFilename } from '$lib/utils/export';
	import DateRangeFilter from '$lib/components/DateRangeFilter.svelte';
	import { rangeFromPreset, isInRange, rangeLabel, type DateRange } from '$lib/utils/dateRange';

	type Tab = 'open' | 'history';

	let activeTab = $state<Tab>('open');

	let openOrders = $state<OrderWithItems[]>([]);
	let historyOrders = $state<Order[]>([]);
	let loadingOpen = $state(true);
	let loadingHistory = $state(true);

	// History filters
	let workerFilter = $state('');
	let paymentFilter = $state('');
	let historyDateRange = $state<DateRange>(rangeFromPreset('today'));

	// Detail modal
	let detailOpen = $state(false);
	let detail = $state<OrderWithItems | null>(null);
	let detailLoading = $state(false);

	// Cancel flow
	let cancelling = $state(false);
	let cancelReason = $state('');
	let showCancel = $state(false);

	async function reloadOpen() {
		loadingOpen = true;
		try {
			openOrders = await ordersDb.listOpen();
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loadingOpen = false;
		}
	}

	async function reloadHistory() {
		loadingHistory = true;
		try {
			const all = await ordersDb.list({ limit: 100 });
			historyOrders = all.filter((o) => o.status !== 'open');
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loadingHistory = false;
		}
	}

	// Live refresh: refetch whichever tab is active when orders change.
	$effect(() => {
		track(dataVersion.orders);
		if (activeTab === 'open') {
			reloadOpen();
		} else {
			reloadHistory();
		}
	});

	const workerOptions = $derived.by(() => {
		const names = new SvelteSet<string>();
		for (const o of historyOrders) {
			if (o.worker_name) names.add(o.worker_name);
		}
		return [
			{ value: '', label: t('common.all') },
			...[...names].sort().map((n) => ({ value: n, label: n }))
		];
	});

	const paymentOptions = $derived([
		{ value: '', label: t('common.all') },
		{ value: 'cash_usd', label: t('payment.cash_usd') },
		{ value: 'cash_bs', label: t('payment.cash_bs') },
		{ value: 'card', label: t('payment.card') },
		{ value: 'pagomovil', label: t('payment.pagomovil') },
		{ value: 'transfer', label: t('payment.transfer') },
		{ value: 'zinli', label: t('payment.zinli') },
		{ value: 'binance', label: t('payment.binance') },
		{ value: 'paypal', label: t('payment.paypal') },
		{ value: 'credit', label: t('payment.credit') }
	]);

	const filteredHistory = $derived(
		historyOrders.filter((o) => {
			if (workerFilter && o.worker_name !== workerFilter) return false;
			if (paymentFilter && o.payment_method !== paymentFilter) return false;
			if (!isInRange(o.created_at, historyDateRange)) return false;
			return true;
		})
	);

	async function openDetail(orderId: string) {
		showCancel = false;
		cancelReason = '';
		detail = null;
		detailLoading = true;
		detailOpen = true;
		try {
			detail = await ordersDb.getById(orderId);
		} catch {
			toast.error(t('toasts.loadFailed'));
			detailOpen = false;
		} finally {
			detailLoading = false;
		}
	}

	function closeDetail() {
		detailOpen = false;
		detail = null;
		showCancel = false;
		cancelReason = '';
	}

	async function submitCancel() {
		if (!detail) return;
		cancelling = true;
		try {
			await ordersDb.cancel(detail.id, cancelReason.trim());
			toast.success(t('toasts.orderCancelled'));
			closeDetail();
			reloadOpen();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			cancelling = false;
		}
	}

	function paymentVariant(method: PaymentMethod | null): 'success' | 'info' | 'secondary' {
		if (method === 'cash_usd' || method === 'cash_bs') return 'success';
		if (method === 'credit') return 'secondary';
		return 'info';
	}

	function statusVariant(status: OrderStatus): 'success' | 'danger' | 'neutral' {
		if (status === 'confirmed') return 'success';
		if (status === 'cancelled') return 'danger';
		return 'neutral';
	}

	function getOrdersExportOptions() {
		const list = activeTab === 'open' ? openOrders : filteredHistory;
		const rows = list.map((o) => ({
			numero: o.order_number,
			fecha: new Date(o.created_at).toLocaleDateString('es-VE'),
			hora: new Date(o.created_at).toLocaleTimeString('es-VE', {
				hour: '2-digit',
				minute: '2-digit'
			}),
			trabajador: o.worker_name ?? '',
			tipo: t('orderType.' + o.order_type),
			estado: t('status.' + o.status),
			metodo_pago: o.payment_method ? t('payment.' + o.payment_method) : '',
			total_usd: (o.total_usd ?? 0).toFixed(2),
			total_bs: (o.total_bs ?? 0).toFixed(2)
		}));
		return {
			filename: dateFilename('pedidos'),
			title: 'Reporte de Pedidos',
			subtitle: `${rows.length} pedidos · ${activeTab === 'open' ? 'Abiertos' : rangeLabel(historyDateRange)}`,
			columns: [
				{ key: 'numero', label: '#' },
				{ key: 'fecha', label: 'Fecha' },
				{ key: 'hora', label: 'Hora' },
				{ key: 'trabajador', label: 'Trabajador' },
				{ key: 'tipo', label: 'Tipo' },
				{ key: 'estado', label: 'Estado' },
				{ key: 'metodo_pago', label: 'Pago' },
				{ key: 'total_usd', label: 'Total USD' },
				{ key: 'total_bs', label: 'Total Bs' }
			],
			rows
		};
	}
</script>

<div class="page flex flex-col gap-4">
	<!-- Tab bar + export -->
	<div class="page-top">
		<div class="tabs flex" role="tablist">
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'open'}
				class="tab"
				class:active={activeTab === 'open'}
				onclick={() => (activeTab = 'open')}
			>
				{t('orders.tabOpen')}
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'history'}
				class="tab"
				class:active={activeTab === 'history'}
				onclick={() => (activeTab = 'history')}
			>
				{t('orders.tabHistory')}
			</button>
		</div>
		<div class="page-top-right">
			{#if activeTab === 'history'}
				<DateRangeFilter value={historyDateRange} onChange={(r) => (historyDateRange = r)} />
			{/if}
			<ExportButton getExportOptions={getOrdersExportOptions} />
		</div>
	</div>

	{#if activeTab === 'open'}
		{#if loadingOpen}
			<div class="flex justify-center p-8">
				<LoadingSpinner size="lg" />
			</div>
		{:else if openOrders.length === 0}
			<EmptyState icon="receipt" title={t('orders.noOpen')} subtitle={t('orders.noOpenHint')} />
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each openOrders as order (order.id)}
					<OrderCard {order} showElapsed onclick={() => openDetail(order.id)} />
				{/each}
			</div>
		{/if}
	{:else if loadingHistory}
		<div class="flex justify-center p-8">
			<LoadingSpinner size="lg" />
		</div>
	{:else}
		<!-- Filters -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Select label={t('orders.filterWorker')} bind:value={workerFilter} options={workerOptions} />
			<Select
				label={t('orders.filterPayment')}
				bind:value={paymentFilter}
				options={paymentOptions}
			/>
		</div>

		{#if filteredHistory.length === 0}
			<EmptyState icon="receipt" title={t('orders.noHistory')} />
		{:else}
			<Card padding="none">
				<ul class="rows">
					{#each filteredHistory as order (order.id)}
						<li>
							<button
								type="button"
								class="row w-full text-left"
								onclick={() => openDetail(order.id)}
							>
								<div class="row-main flex items-center gap-3">
									<span class="number">#{order.order_number}</span>
									<div class="flex flex-col gap-0.5 min-w-0">
										<span class="when">{formatDateTime(order.created_at)}</span>
										{#if order.worker_name}
											<span class="worker">{order.worker_name}</span>
										{/if}
									</div>
									<span class="total tabular-nums ml-auto">{formatUsd(order.total_usd)}</span>
								</div>
								<div class="row-meta flex flex-wrap items-center gap-2">
									<span class="muted">{timeAgo(order.created_at)}</span>
									{#if order.payment_method && order.status === 'confirmed'}
										<Badge variant={paymentVariant(order.payment_method)}>
											{t('payment.' + order.payment_method)}
										</Badge>
									{/if}
									<Badge variant={statusVariant(order.status)}>
										{t('status.' + order.status)}
									</Badge>
								</div>
							</button>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}
	{/if}
</div>

<!-- Detail modal -->
<Modal bind:open={detailOpen} title={t('orders.detail')} onclose={closeDetail}>
	{#if detailLoading}
		<div class="flex justify-center p-6">
			<LoadingSpinner />
		</div>
	{:else if detail}
		<div class="flex flex-col gap-4">
			<div class="detail-head flex flex-wrap items-center gap-2">
				<span class="number">#{detail.order_number}</span>
				{#if detail.order_type === 'dine_in'}
					<Badge variant="info">{t('orderType.dine_in')}</Badge>
				{:else}
					<Badge variant="secondary">{t('orderType.takeout')}</Badge>
				{/if}
				<Badge variant={statusVariant(detail.status)}>{t('status.' + detail.status)}</Badge>
				{#if detail.payment_method && detail.status === 'confirmed'}
					<Badge variant={paymentVariant(detail.payment_method)}>
						{t('payment.' + detail.payment_method)}
					</Badge>
				{/if}
			</div>

			<div class="detail-meta flex flex-col gap-1">
				<span class="muted">{formatDateTime(detail.created_at)}</span>
				{#if detail.worker_name}
					<span class="muted">{t('orders.worker')}: {detail.worker_name}</span>
				{/if}
				{#if detail.customer_name}
					<span class="muted">{detail.customer_name}</span>
				{/if}
			</div>

			<!-- Items -->
			<ul class="items flex flex-col">
				{#each detail.items as item (item.id)}
					<li class="item flex items-center gap-3">
						<span class="item-name">{item.menu_item_snapshot.name}</span>
						<span class="item-qty tabular-nums">&times;{item.qty}</span>
						<span class="item-total tabular-nums ml-auto">{formatUsd(item.line_total_usd)}</span>
					</li>
				{/each}
			</ul>

			<!-- Totals -->
			<div class="totals flex flex-col gap-1">
				<div class="flex items-center justify-between">
					<span class="muted">{t('orders.subtotal')}</span>
					<span class="tabular-nums">{formatUsd(detail.subtotal_usd)}</span>
				</div>
				{#if detail.discount_usd > 0}
					<div class="flex items-center justify-between">
						<span class="muted">{t('orders.discount')}</span>
						<span class="tabular-nums">-{formatUsd(detail.discount_usd)}</span>
					</div>
				{/if}
				<div class="flex items-center justify-between total-row">
					<span>{t('orders.total')}</span>
					<span class="total tabular-nums">{formatUsd(detail.total_usd)}</span>
				</div>
			</div>

			{#if detail.status === 'cancelled' && detail.cancel_reason}
				<p class="cancel-reason">{detail.cancel_reason}</p>
			{/if}

			<!-- Cancel flow (open orders only) -->
			{#if detail.status === 'open'}
				{#if showCancel}
					<div class="flex flex-col gap-2">
						<label class="field-label" for="cancel-reason">{t('orders.cancelReason')}</label>
						<textarea id="cancel-reason" class="cancel-input" bind:value={cancelReason} rows="2"
						></textarea>
						<div class="flex gap-2">
							<Button variant="ghost" onclick={() => (showCancel = false)}>
								{t('common.cancel')}
							</Button>
							<Button variant="danger" full loading={cancelling} onclick={submitCancel}>
								{t('orders.cancel')}
							</Button>
						</div>
					</div>
				{:else}
					<Button variant="danger" full onclick={() => (showCancel = true)}>
						{t('orders.cancel')}
					</Button>
				{/if}
			{/if}
		</div>
	{/if}
</Modal>

<style>
	.page {
		font-family: var(--font-sans);
		color: var(--color-text);
		padding: 24px 26px 44px;
	}

	/* Tab bar + export row */
	.page-top {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--color-line);
	}

	.tabs {
		gap: 4px;
	}

	.page-top-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		padding-bottom: 6px;
	}

	.tab {
		min-height: 48px;
		padding: 0 16px;
		font-family: var(--font-sans);
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-text-dim);
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		transition:
			color 150ms ease,
			border-color 150ms ease;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		color: var(--color-mustard);
		border-bottom-color: var(--color-mustard);
	}

	@media (max-width: 640px) {
		.page {
			padding: 18px 16px 80px;
		}
	}

	/* History rows */
	.rows {
		display: flex;
		flex-direction: column;
	}

	.rows li + li .row {
		border-top: 1px solid var(--color-surface-overlay);
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 48px;
		padding: 14px 16px;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background 150ms ease;
	}

	.row:hover {
		background: var(--color-surface-overlay);
	}

	.row:active {
		transform: scale(0.99);
	}

	.number {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.when {
		font-size: 0.9375rem;
		color: var(--color-text-primary);
	}

	.worker {
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.total {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--color-accent);
	}

	.muted {
		font-size: 13px;
		color: var(--color-text-muted);
	}

	/* Detail modal */
	.items {
		gap: 0;
		border-top: 1px solid var(--color-surface-overlay);
		border-bottom: 1px solid var(--color-surface-overlay);
	}

	.item {
		padding: 10px 0;
	}

	.item + .item {
		border-top: 1px solid var(--color-surface-overlay);
	}

	.item-name {
		font-size: 0.9375rem;
		color: var(--color-text-primary);
	}

	.item-qty {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.item-total {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.total-row {
		margin-top: 4px;
		padding-top: 8px;
		border-top: 1px solid var(--color-surface-overlay);
		font-weight: 700;
		font-size: 1.0625rem;
	}

	.cancel-reason {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		background: var(--color-surface-overlay);
		border-radius: var(--radius-md);
		padding: 10px 12px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.cancel-input {
		width: 100%;
		min-height: 64px;
		padding: 12px;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		font-size: 16px;
		resize: vertical;
		transition: border-color 150ms ease;
	}

	.cancel-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}
</style>
