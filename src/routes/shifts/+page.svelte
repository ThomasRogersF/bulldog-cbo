<script lang="ts">
	import { onMount } from 'svelte';
	import { shiftStore, loadActiveShift, openShift, closeShift } from '$lib/stores/shift.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { ordersDb, shiftsDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import { formatUsd, formatBs, formatDate, formatDuration } from '$lib/utils/format';
	import type { OrderWithItems, PaymentMethod, Shift } from '$lib/types';
	import { SvelteMap } from 'svelte/reactivity';
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Icon from '$lib/components/Icon.svelte';

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

	// Confirmed orders (with items) for the active shift — drives the close summary.
	let shiftOrders = $state<OrderWithItems[]>([]);
	let statsLoading = $state(false);

	// Close-shift modal state
	let closeOpen = $state(false);
	let closingCash = $state('');
	let closeNotes = $state('');
	let closing = $state(false);

	// History
	let history = $state<Shift[]>([]);
	let historyLoading = $state(false);

	// Last closed shift's takings — shown in the open-shift greeting.
	let yesterdaySummary = $state<{ orders: number; totalUsd: number } | null>(null);

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

	const totalSalesBs = $derived(shiftOrders.reduce((sum, o) => sum + Number(o.total_bs ?? 0), 0));

	const topItems = $derived.by(() => {
		const qtyByName = new SvelteMap<string, number>();
		for (const o of shiftOrders) {
			for (const it of o.items) {
				const name = it.menu_item_snapshot.name;
				qtyByName.set(name, (qtyByName.get(name) ?? 0) + it.qty);
			}
		}
		return [...qtyByName.entries()]
			.map(([name, qty]) => ({ name, qty }))
			.sort((a, b) => b.qty - a.qty)
			.slice(0, 3);
	});

	// Cash-count variance for the close modal — recomputes live as the worker types.
	const countedCash = $derived(parseFloat(closingCash));
	const hasCount = $derived(
		closingCash.trim() !== '' && !Number.isNaN(countedCash) && countedCash >= 0
	);
	const varianceAmount = $derived(hasCount ? countedCash - expectedCash : 0);
	const varianceKind = $derived.by(() => {
		if (!hasCount) return 'pending';
		if (Math.abs(varianceAmount) < 0.005) return 'none';
		return varianceAmount > 0 ? 'surplus' : 'shortage';
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
			shiftOrders = await ordersDb.listConfirmedForShift(active.id);
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

	async function loadYesterday(shiftId: string): Promise<void> {
		try {
			const orders = await ordersDb.list({ shiftId, status: 'confirmed', limit: 500 });
			yesterdaySummary = {
				orders: orders.length,
				totalUsd: orders.reduce((sum, o) => sum + Number(o.total_usd ?? 0), 0)
			};
		} catch {
			yesterdaySummary = null;
		}
	}

	function greetingKey(): string {
		const hour = new Date().getHours();
		if (hour < 12) return 'shifts.greetingMorning';
		if (hour < 19) return 'shifts.greetingAfternoon';
		return 'shifts.greetingEvening';
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

	// When no shift is open, surface the most recent closed shift's takings.
	$effect(() => {
		const last = closedHistory[0];
		if (shiftStore.active) {
			yesterdaySummary = null;
		} else if (last) {
			void loadYesterday(last.id);
		}
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
	{#if shiftStore.loading && !shiftStore.active}
		<div class="flex justify-center py-12">
			<LoadingSpinner size="lg" />
		</div>
	{:else if !shiftStore.active}
		<!-- No active shift → open prompt -->
		<Card padding="lg">
			<div class="flex flex-col items-center text-center gap-1">
				<img class="prompt-icon" src="/bulldog-logo.png" alt="" aria-hidden="true" />
				<h2 class="greeting">{t(greetingKey())}</h2>
				{#if authStore.profile}
					<p class="greeting-name">{authStore.profile.full_name}</p>
				{/if}
				<p class="prompt-subtitle">{t('shifts.noActivePrompt')}</p>
			</div>

			{#if yesterdaySummary}
				<p class="yesterday">
					{t('shifts.yesterday')}:
					<span class="tabular-nums">{yesterdaySummary.orders}</span>
					{t('shifts.ordersShort')} ·
					<span class="tabular-nums">{formatUsd(yesterdaySummary.totalUsd)}</span>
				</p>
			{/if}

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
				<Button type="submit" variant="danger" size="lg" full loading={opening}>
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
			<div class="close-modal flex max-h-[70vh] flex-col gap-5 overflow-y-auto">
				<!-- ── Section 1 — Resumen del turno (read-only) ───────────────── -->
				<section class="flex flex-col gap-3">
					<h3 class="section-title">{t('shifts.summary')}</h3>

					<div class="summary-head flex items-baseline justify-between gap-3">
						<span class="summary-shift">{t('shifts.number')} #{active.shift_number}</span>
						<span class="summary-duration tabular-nums">{formatDuration(active.opened_at)}</span>
					</div>

					<div class="sales-block">
						<span class="sales-usd tabular-nums">{formatUsd(active.total_sales_usd)}</span>
						<span class="sales-bs tabular-nums">{formatBs(totalSalesBs)}</span>
						<span class="sales-caption tabular-nums">
							{active.confirmed_orders}
							{t('shifts.ordersShort')}
						</span>
					</div>

					<div class="divider"></div>

					<h4 class="sub-title">{t('shifts.paymentBreakdown')}</h4>
					{#if breakdown.length === 0}
						<p class="hint">{t('empty.noData')}</p>
					{:else}
						<ul class="flex flex-col gap-1">
							{#each breakdown as row (row.method)}
								<li class="breakdown-row flex items-center justify-between gap-3">
									<span class="breakdown-method">{t('payment.' + row.method)}</span>
									<span class="breakdown-total tabular-nums">{formatUsd(row.total)}</span>
								</li>
							{/each}
						</ul>
					{/if}

					{#if topItems.length > 0}
						<div class="divider"></div>
						<h4 class="sub-title">{t('shifts.topItems')}</h4>
						<ol class="flex flex-col gap-1">
							{#each topItems as item, i (item.name)}
								<li class="top-row flex items-center justify-between gap-3">
									<span class="top-name">
										<span class="top-rank tabular-nums">{i + 1}.</span>
										{item.name}
									</span>
									<span class="top-qty tabular-nums">×{item.qty}</span>
								</li>
							{/each}
						</ol>
					{/if}
				</section>

				<!-- ── Section 2 — Cierre de caja ──────────────────────────────── -->
				<section class="cash-section flex flex-col gap-3">
					<h3 class="section-title">{t('shifts.cashClose')}</h3>

					<div class="flex flex-col gap-1.5">
						<Input
							label={t('shifts.countedCash')}
							bind:value={closingCash}
							type="number"
							inputmode="decimal"
							placeholder="0.00"
						/>
						<p class="expected-hint">
							{t('shifts.expectedShort')}:
							<span class="tabular-nums">{formatUsd(expectedCash)}</span>
						</p>

						{#if varianceKind === 'none'}
							<p class="variance-line good">
								<Icon name="checkcircle" size={15} />
								{t('shifts.noDifference')}
							</p>
						{:else if varianceKind === 'surplus'}
							<p class="variance-line good">
								<Icon name="arrowUp" size={15} stroke={2.4} />
								{t('shifts.surplus')}: +{formatUsd(varianceAmount)}
							</p>
						{:else if varianceKind === 'shortage'}
							<p class="variance-line bad">
								<Icon name="arrowDown" size={15} stroke={2.4} />
								{t('shifts.shortage')}: -{formatUsd(-varianceAmount)}
							</p>
						{/if}
					</div>

					<Input
						label={t('shifts.notes')}
						bind:value={closeNotes}
						placeholder={t('shifts.notesPlaceholder')}
					/>

					<Button
						variant="danger"
						size="lg"
						full
						loading={closing}
						onclick={() => void handleClose()}
					>
						{closing ? t('shifts.closing') : t('shifts.close')}
					</Button>
					<button type="button" class="cancel-link" onclick={() => (closeOpen = false)}>
						{t('common.cancel')}
					</button>
				</section>
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
				<EmptyState icon="clock" title={t('shifts.noHistory')} />
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
	.prompt-icon {
		width: 64px;
		height: auto;
		border-radius: 16px;
		margin-bottom: 4px;
	}

	.greeting {
		font-family: var(--font-sans);
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.greeting-name {
		font-family: var(--font-sans);
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-accent);
	}

	.yesterday {
		margin-top: 16px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--color-surface-overlay);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		text-align: center;
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

	/* ── Close modal: end-of-day summary ─────────────────────────── */
	.summary-head {
		font-family: var(--font-sans);
	}

	.summary-shift {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.summary-duration {
		font-family: var(--font-mono);
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
	}

	.sales-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 14px 12px;
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
	}

	.sales-usd {
		font-family: var(--font-mono);
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.1;
		color: var(--color-accent);
	}

	.sales-bs {
		font-family: var(--font-mono);
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
	}

	.sales-caption {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.sub-title {
		font-family: var(--font-sans);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.top-row {
		padding: 4px 0;
	}

	.top-name {
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		color: var(--color-text-primary);
	}

	.top-rank {
		margin-right: 4px;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}

	.top-qty {
		font-family: var(--font-mono);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.cash-section {
		padding-top: 16px;
		border-top: 1px solid var(--color-surface-overlay);
	}

	.expected-hint {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.variance-line {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.variance-line.good {
		color: var(--color-success);
	}

	.variance-line.bad {
		color: var(--color-danger);
	}

	.cancel-link {
		align-self: center;
		padding: 8px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		cursor: pointer;
	}

	.cancel-link:hover {
		color: var(--color-text-secondary);
		text-decoration: underline;
	}
</style>
