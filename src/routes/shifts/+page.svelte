<script lang="ts">
	import { onMount } from 'svelte';
	import { shiftStore, loadActiveShift, openShift, closeShift } from '$lib/stores/shift.svelte';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { ordersDb, shiftsDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import { formatUsd, formatDate, formatDuration } from '$lib/utils/format';
	import type { Order, PaymentMethod, Shift } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	const PAYMENT_METHODS: PaymentMethod[] = [
		'cash_usd',
		'cash_bs',
		'card',
		'pagomovil',
		'transfer',
		'zinli',
		'binance',
		'paypal',
		'credit'
	];

	// Open-shift form state
	let openingCash = $state('');
	let openNotes = $state('');
	let opening = $state(false);

	// Confirmed orders for the active shift (for cash-expected + breakdown)
	let shiftOrders = $state<Order[]>([]);
	let statsLoading = $state(false);

	// Close-shift modal state
	let closeOpen = $state(false);
	let closingCash = $state('');
	let closeNotes = $state('');
	let closing = $state(false);

	// History
	let history = $state<Shift[]>([]);
	let historyLoading = $state(false);

	const cashSalesUsd = $derived(
		shiftOrders
			.filter((o) => o.payment_method === 'cash_usd')
			.reduce((sum, o) => sum + Number(o.total_usd ?? 0), 0)
	);

	const expectedCash = $derived(Number(shiftStore.active?.opening_cash_usd ?? 0) + cashSalesUsd);

	const breakdown = $derived.by(() => {
		const totals = new SvelteMap<PaymentMethod, number>();
		for (const o of shiftOrders) {
			if (!o.payment_method) continue;
			totals.set(o.payment_method, (totals.get(o.payment_method) ?? 0) + Number(o.total_usd ?? 0));
		}
		return PAYMENT_METHODS.filter((m) => totals.has(m)).map((m) => ({
			method: m,
			total: totals.get(m) ?? 0
		}));
	});

	const closedHistory = $derived(history.filter((s) => s.closed_at !== null));

	async function loadStats(): Promise<void> {
		const active = shiftStore.active;
		if (!active) {
			shiftOrders = [];
			return;
		}
		statsLoading = true;
		try {
			shiftOrders = await ordersDb.list({ shiftId: active.id, status: 'confirmed', limit: 500 });
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			statsLoading = false;
		}
	}

	async function loadHistory(): Promise<void> {
		historyLoading = true;
		try {
			history = await shiftsDb.list(20);
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			historyLoading = false;
		}
	}

	onMount(() => {
		void loadActiveShift();
	});

	// Live refresh — refetch active shift, stats and history when shifts/orders change.
	$effect(() => {
		track(dataVersion.shifts);
		void loadHistory();
	});

	$effect(() => {
		// Reading these keeps stats in sync with realtime + the active shift.
		track(dataVersion.orders, dataVersion.shifts, shiftStore.active?.id);
		void loadStats();
	});

	async function handleOpen(): Promise<void> {
		const cash = parseFloat(openingCash);
		if (Number.isNaN(cash) || cash < 0) {
			toast.error(t('validation.invalidNumber'));
			return;
		}
		opening = true;
		try {
			await openShift(cash, openNotes.trim() || undefined);
			openingCash = '';
			openNotes = '';
			toast.success(t('toasts.shiftOpened'));
		} catch (err) {
			if (err instanceof Error && err.message === 'shiftAlreadyOpen') {
				toast.error(t('toasts.shiftAlreadyOpen'));
			} else {
				toast.error(t('toasts.saveFailed'));
			}
		} finally {
			opening = false;
		}
	}

	function openCloseModal(): void {
		closingCash = '';
		closeNotes = '';
		closeOpen = true;
	}

	async function handleClose(): Promise<void> {
		const active = shiftStore.active;
		if (!active) return;
		const cash = parseFloat(closingCash);
		if (Number.isNaN(cash) || cash < 0) {
			toast.error(t('validation.invalidNumber'));
			return;
		}
		closing = true;
		try {
			await closeShift(active.id, cash, closeNotes.trim() || undefined);
			closeOpen = false;
			toast.success(t('toasts.shiftClosed'));
			void loadHistory();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			closing = false;
		}
	}
</script>

<div class="page mx-auto w-full max-w-2xl px-4 py-6 flex flex-col gap-6">
	<h1 class="page-title">{t('shifts.title')}</h1>

	{#if shiftStore.loading && !shiftStore.active}
		<div class="flex justify-center py-12">
			<LoadingSpinner size="lg" />
		</div>
	{:else if !shiftStore.active}
		<!-- No active shift → open prompt -->
		<Card padding="lg">
			<div class="flex flex-col items-center text-center gap-2">
				<span class="prompt-icon" aria-hidden="true">🌭</span>
				<h2 class="prompt-title">{t('shifts.noActive')}</h2>
				<p class="prompt-subtitle">{t('shifts.noActivePrompt')}</p>
			</div>
			<form
				class="flex flex-col gap-4 mt-6"
				onsubmit={(e) => {
					e.preventDefault();
					void handleOpen();
				}}
			>
				<Input
					label={t('shifts.openingCash')}
					bind:value={openingCash}
					type="number"
					inputmode="decimal"
					placeholder="0.00"
				/>
				<Input
					label={t('shifts.notes')}
					bind:value={openNotes}
					placeholder={t('shifts.notesPlaceholder')}
				/>
				<Button type="submit" size="lg" full loading={opening}>
					{opening ? t('shifts.opening') : t('shifts.open')}
				</Button>
			</form>
		</Card>
	{:else}
		<!-- Active shift → info + stats + close -->
		{@const active = shiftStore.active}
		<Card padding="lg">
			<div class="flex items-start justify-between gap-3">
				<div class="flex flex-col gap-1">
					<span class="shift-number">{t('shifts.number')} #{active.shift_number}</span>
					{#if active.opened_by_name}
						<span class="meta">{t('shifts.openedBy')}: {active.opened_by_name}</span>
					{/if}
					<span class="meta">
						{t('shifts.duration')}: {formatDuration(active.opened_at)}
					</span>
				</div>
				<Badge variant="success">{t('shifts.active')}</Badge>
			</div>

			<div class="grid grid-cols-2 gap-4 mt-6">
				<div class="stat">
					<span class="stat-label">{t('shifts.ordersCount')}</span>
					<span class="stat-value tabular-nums">{active.confirmed_orders}</span>
				</div>
				<div class="stat">
					<span class="stat-label">{t('shifts.salesTotal')}</span>
					<span class="stat-value tabular-nums">{formatUsd(active.total_sales_usd)}</span>
				</div>
			</div>
		</Card>

		<!-- Quick stats: expected cash + payment breakdown -->
		<Card padding="lg">
			{#if statsLoading}
				<div class="flex justify-center py-6">
					<LoadingSpinner />
				</div>
			{:else}
				<div class="flex items-center justify-between gap-3">
					<div class="flex flex-col">
						<span class="stat-label">{t('shifts.expectedCash')}</span>
						<span class="hint">{t('shifts.cashExpectedHint')}</span>
					</div>
					<span class="expected-cash tabular-nums">{formatUsd(expectedCash)}</span>
				</div>

				<div class="divider"></div>

				<h3 class="section-title">{t('shifts.paymentBreakdown')}</h3>
				{#if breakdown.length === 0}
					<p class="hint mt-2">{t('empty.noData')}</p>
				{:else}
					<ul class="flex flex-col gap-1 mt-2">
						{#each breakdown as row (row.method)}
							<li class="breakdown-row flex items-center justify-between gap-3">
								<span class="breakdown-method">{t('payment.' + row.method)}</span>
								<span class="breakdown-total tabular-nums">{formatUsd(row.total)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</Card>

		<Button variant="danger" size="lg" full onclick={openCloseModal}>
			{t('shifts.close')}
		</Button>

		<Modal bind:open={closeOpen} title={t('shifts.close')}>
			<div class="flex flex-col gap-4">
				<div class="flex items-center justify-between gap-3">
					<span class="stat-label">{t('shifts.expectedCash')}</span>
					<span class="expected-cash tabular-nums">{formatUsd(expectedCash)}</span>
				</div>
				<Input
					label={t('shifts.closingCash')}
					bind:value={closingCash}
					type="number"
					inputmode="decimal"
					placeholder="0.00"
				/>
				<Input
					label={t('shifts.notes')}
					bind:value={closeNotes}
					placeholder={t('shifts.notesPlaceholder')}
				/>
				<div class="flex gap-3">
					<Button variant="ghost" full onclick={() => (closeOpen = false)}>
						{t('common.cancel')}
					</Button>
					<Button variant="danger" full loading={closing} onclick={() => void handleClose()}>
						{closing ? t('shifts.closing') : t('shifts.close')}
					</Button>
				</div>
			</div>
		</Modal>
	{/if}

	<!-- Shift history -->
	<section class="flex flex-col gap-3">
		<h2 class="section-heading">{t('shifts.history')}</h2>
		{#if historyLoading && closedHistory.length === 0}
			<div class="flex justify-center py-8">
				<LoadingSpinner />
			</div>
		{:else if closedHistory.length === 0}
			<Card padding="lg">
				<EmptyState icon="📋" title={t('shifts.noHistory')} />
			</Card>
		{:else}
			<div class="flex flex-col gap-3">
				{#each closedHistory as s (s.id)}
					<Card>
						<div class="flex items-start justify-between gap-3">
							<div class="flex flex-col gap-1">
								<span class="history-number">{t('shifts.number')} #{s.shift_number}</span>
								<span class="meta">{formatDate(s.opened_at)}</span>
								<span class="meta">
									{t('shifts.duration')}: {formatDuration(s.opened_at, s.closed_at)}
								</span>
							</div>
							<Badge variant="neutral">{t('shifts.closed')}</Badge>
						</div>

						<div class="grid grid-cols-3 gap-3 mt-4">
							<div class="stat-sm">
								<span class="stat-label">{t('shifts.closingCash')}</span>
								<span class="stat-value-sm tabular-nums">{formatUsd(s.closing_cash_usd)}</span>
							</div>
							<div class="stat-sm">
								<span class="stat-label">{t('shifts.expectedCash')}</span>
								<span class="stat-value-sm tabular-nums">{formatUsd(s.expected_cash_usd)}</span>
							</div>
							<div class="stat-sm">
								<span class="stat-label">{t('shifts.variance')}</span>
								<span class="stat-value-sm tabular-nums" class:negative={(s.variance_usd ?? 0) < 0}>
									{formatUsd(s.variance_usd)}
								</span>
							</div>
						</div>
					</Card>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.page-title {
		font-family: var(--font-sans);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.prompt-icon {
		font-size: 56px;
		line-height: 1;
	}

	.prompt-title {
		font-family: var(--font-sans);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.prompt-subtitle {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--color-text-muted);
	}

	.shift-number {
		font-family: var(--font-sans);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.history-number {
		font-family: var(--font-sans);
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.meta {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.stat-sm {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-label {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.stat-value-sm {
		font-family: var(--font-mono);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.stat-value-sm.negative {
		color: var(--color-danger);
	}

	.hint {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.expected-cash {
		font-family: var(--font-mono);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-accent);
	}

	.divider {
		height: 1px;
		background: var(--color-surface-overlay);
		margin: 16px 0;
	}

	.section-title {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.breakdown-row {
		padding: 6px 0;
	}

	.breakdown-method {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--color-text-primary);
	}

	.breakdown-total {
		font-family: var(--font-mono);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.section-heading {
		font-family: var(--font-sans);
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}
</style>
