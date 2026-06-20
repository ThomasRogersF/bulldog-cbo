<script lang="ts">
	import { customersDb } from '$lib/db';
	import type { CustomerStats, Order, CustomerSource, GroupTag } from '$lib/types';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/stores/toast.svelte';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';
	import { formatUsd, formatDate } from '$lib/utils/format';

	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Input from '$lib/components/Input.svelte';
	import Select from '$lib/components/Select.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import OrderCard from '$lib/components/OrderCard.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import ExportButton from '$lib/components/ExportButton.svelte';
	import { dateFilename } from '$lib/utils/export';
	import DateRangeFilter from '$lib/components/DateRangeFilter.svelte';
	import { rangeFromPreset, isInRange, rangeLabel, type DateRange } from '$lib/utils/dateRange';

	// ── List state ────────────────────────────────────────────────────────────
	let customers = $state<CustomerStats[]>([]);
	let loading = $state(true);
	let query = $state('');
	let searching = $state(false);
	let custDateRange = $state<DateRange>(rangeFromPreset('all'));

	const filteredCustomers = $derived(
		customers.filter((c) => {
			if (custDateRange.preset === 'all') return true;
			if (!c.last_purchase_at) return false;
			return isInRange(c.last_purchase_at, custDateRange);
		})
	);

	// Source / group option builders (labels resolved via t() in markup helpers).
	const SOURCES: CustomerSource[] = ['walk_in', 'regular', 'delivery', 'referred', 'other'];
	const GROUPS: GroupTag[] = ['vip', 'regular', 'crew', 'wholesale'];

	const sourceOptions = $derived(
		SOURCES.map((s) => ({ value: s, label: t('customerSource.' + s) }))
	);
	const groupOptions = $derived([
		{ value: '', label: t('common.none') },
		...GROUPS.map((g) => ({ value: g, label: t('customerGroup.' + g) }))
	]);

	function groupVariant(tag: GroupTag): 'secondary' | 'neutral' | 'info' | 'success' {
		if (tag === 'vip') return 'secondary';
		if (tag === 'crew') return 'info';
		if (tag === 'wholesale') return 'success';
		return 'neutral';
	}

	async function reload(): Promise<void> {
		try {
			const term = query.trim();
			customers = term ? await customersDb.search(term) : await customersDb.list();
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loading = false;
			searching = false;
		}
	}

	// Debounced search on input.
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearchInput(): void {
		searching = true;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			void reload();
		}, 250);
	}

	// Initial load + live refresh when orders change (affects purchase stats).
	$effect(() => {
		track(dataVersion.orders);
		void reload();
	});

	// ── Detail slide-over state ─────────────────────────────────────────────────
	let detailOpen = $state(false);
	let selected = $state<CustomerStats | null>(null);
	let history = $state<Order[]>([]);
	let historyLoading = $state(false);
	let editing = $state(false);
	let saving = $state(false);

	// Edit form fields.
	let editName = $state('');
	let editPhone = $state('');
	let editNotes = $state('');
	let editSource = $state<string>('walk_in');
	let editGroup = $state<string>('');

	// Credit payment form.
	let payOpen = $state(false);
	let payAmount = $state('');
	let payError = $state('');
	let payingSaving = $state(false);

	async function openDetail(c: CustomerStats): Promise<void> {
		selected = c;
		editing = false;
		payOpen = false;
		payAmount = '';
		payError = '';
		detailOpen = true;
		await loadHistory(c.id);
	}

	async function loadHistory(id: string): Promise<void> {
		historyLoading = true;
		try {
			history = await customersDb.orderHistory(id, 10);
		} catch {
			toast.error(t('toasts.loadFailed'));
			history = [];
		} finally {
			historyLoading = false;
		}
	}

	function startEdit(): void {
		if (!selected) return;
		editName = selected.name;
		editPhone = selected.phone ?? '';
		editNotes = selected.notes ?? '';
		editSource = selected.source;
		editGroup = selected.group_tag ?? '';
		editing = true;
	}

	async function saveEdit(): Promise<void> {
		if (!selected) return;
		if (!editName.trim()) {
			toast.error(t('validation.required'));
			return;
		}
		saving = true;
		try {
			await customersDb.update(selected.id, {
				name: editName.trim(),
				phone: editPhone.trim() || null,
				notes: editNotes.trim() || null,
				source: editSource as CustomerSource,
				group_tag: editGroup ? (editGroup as GroupTag) : null
			});
			toast.success(t('customers.saved'));
			editing = false;
			await reload();
			selected = (await customersDb.getById(selected.id)) ?? selected;
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			saving = false;
		}
	}

	function openPayment(): void {
		payAmount = '';
		payError = '';
		payOpen = true;
	}

	async function registerPayment(): Promise<void> {
		if (!selected) return;
		const amount = Number(payAmount.replace(',', '.'));
		if (!Number.isFinite(amount) || amount <= 0) {
			payError = t('validation.mustBePositive');
			return;
		}
		payingSaving = true;
		try {
			const next = Math.max(0, selected.credit_balance_usd - amount);
			await customersDb.update(selected.id, { credit_balance_usd: next });
			toast.success(t('toasts.paymentRegistered'));
			payOpen = false;
			payAmount = '';
			await reload();
			selected = (await customersDb.getById(selected.id)) ?? selected;
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			payingSaving = false;
		}
	}

	// ── Add modal state ─────────────────────────────────────────────────────────
	let addOpen = $state(false);
	let addSaving = $state(false);
	let addName = $state('');
	let addPhone = $state('');
	let addNotes = $state('');
	let addSource = $state<string>('walk_in');
	let addGroup = $state<string>('');
	let addError = $state('');

	function openAdd(): void {
		addName = '';
		addPhone = '';
		addNotes = '';
		addSource = 'walk_in';
		addGroup = '';
		addError = '';
		addOpen = true;
	}

	function getCustomersExportOptions() {
		const rows = filteredCustomers.map((c) => ({
			nombre: c.name,
			telefono: c.phone ?? '',
			origen: t('customerSource.' + c.source),
			grupo: c.group_tag ? t('customerGroup.' + c.group_tag) : '',
			compras: c.purchase_count,
			total_gastado: c.total_spent_usd.toFixed(2),
			ultima_compra: c.last_purchase_at
				? new Date(c.last_purchase_at).toLocaleDateString('es-VE')
				: t('customers.never'),
			saldo_pendiente: c.credit_balance_usd.toFixed(2)
		}));
		return {
			filename: dateFilename('clientes'),
			title: 'Reporte de Clientes',
			subtitle: `${rows.length} clientes · ${rangeLabel(custDateRange)}`,
			columns: [
				{ key: 'nombre', label: 'Nombre' },
				{ key: 'telefono', label: 'Teléfono' },
				{ key: 'origen', label: 'Origen' },
				{ key: 'grupo', label: 'Grupo' },
				{ key: 'compras', label: 'Compras' },
				{ key: 'total_gastado', label: 'Total gastado USD' },
				{ key: 'ultima_compra', label: 'Última compra' },
				{ key: 'saldo_pendiente', label: 'Saldo pendiente USD' }
			],
			rows
		};
	}

	async function createCustomer(): Promise<void> {
		if (!addName.trim()) {
			addError = t('validation.required');
			return;
		}
		addSaving = true;
		try {
			await customersDb.create({
				name: addName.trim(),
				phone: addPhone.trim() || null,
				source: addSource as CustomerSource,
				group_tag: addGroup ? (addGroup as GroupTag) : null,
				notes: addNotes.trim() || null
			});
			toast.success(t('customers.saved'));
			addOpen = false;
			await reload();
		} catch {
			toast.error(t('toasts.saveFailed'));
		} finally {
			addSaving = false;
		}
	}
</script>

<div class="page mx-auto w-full max-w-3xl px-4 py-6 flex flex-col gap-4">
	<!-- Header action (title shown in the TopBar) -->
	<div class="hidden md:flex justify-end">
		<Button icon="plus" onclick={openAdd}>{t('customers.add')}</Button>
	</div>

	<!-- Search + export -->
	<div class="search-row flex items-center gap-2">
		<div class="flex-1">
			<Input
				bind:value={query}
				type="search"
				inputmode="search"
				placeholder={t('customers.searchPlaceholder')}
				oninput={onSearchInput}
			/>
		</div>
		{#if searching}
			<LoadingSpinner size="sm" />
		{/if}
		<DateRangeFilter value={custDateRange} onChange={(r) => (custDateRange = r)} />
		<ExportButton getExportOptions={getCustomersExportOptions} disabled={loading} />
	</div>

	<!-- List -->
	{#if loading}
		<div class="flex justify-center py-12">
			<LoadingSpinner size="lg" />
		</div>
	{:else if filteredCustomers.length === 0}
		{#if customers.length === 0 && !query.trim() && custDateRange.preset === 'all'}
			<EmptyState icon="users" title={t('customers.noCustomers')}>
				{#snippet action()}
					<Button onclick={openAdd}>{t('customers.add')}</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState icon="search" title={t('customers.noResults')} />
		{/if}
	{:else}
		<div class="flex flex-col gap-3">
			{#each filteredCustomers as c (c.id)}
				<button type="button" class="card-btn w-full text-left" onclick={() => openDetail(c)}>
					<Card>
						<div class="flex items-start gap-3">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="cust-name">{c.name}</span>
									{#if c.group_tag}
										<Badge variant={groupVariant(c.group_tag)}>
											{t('customerGroup.' + c.group_tag)}
										</Badge>
									{/if}
									<Badge variant="neutral">{t('customerSource.' + c.source)}</Badge>
								</div>
								{#if c.phone}
									<p class="cust-phone">{c.phone}</p>
								{/if}
								<div class="meta flex flex-wrap items-center gap-x-4 gap-y-1">
									<span class="meta-item">
										{t('customers.purchases')}:
										<span class="tabular-nums num">{c.purchase_count}</span>
									</span>
									<span class="meta-item">
										{t('customers.totalSpent')}:
										<span class="tabular-nums num">{formatUsd(c.total_spent_usd)}</span>
									</span>
									<span class="meta-item">
										{t('customers.lastPurchase')}:
										<span class="num">
											{c.last_purchase_at ? formatDate(c.last_purchase_at) : t('customers.never')}
										</span>
									</span>
								</div>
								{#if c.credit_balance_usd > 0}
									<p class="owes tabular-nums">
										{t('customers.owesUs')}: {formatUsd(c.credit_balance_usd)}
									</p>
								{/if}
							</div>
						</div>
					</Card>
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Floating add button (mobile) -->
<button type="button" class="fab md:hidden" aria-label={t('customers.add')} onclick={openAdd}>
	<Icon name="plus" size={24} stroke={2.6} />
</button>

<!-- ── Detail slide-over ─────────────────────────────────────────────────────── -->
<Modal bind:open={detailOpen} title={t('customers.detail')}>
	{#if selected}
		<div class="flex flex-col gap-5">
			<!-- Profile -->
			{#if editing}
				<div class="flex flex-col gap-3">
					<Input label={t('customers.name')} bind:value={editName} />
					<Input label={t('customers.phone')} bind:value={editPhone} type="tel" inputmode="tel" />
					<Select label={t('customers.source')} bind:value={editSource} options={sourceOptions} />
					<Select
						label={t('customers.group')}
						bind:value={editGroup}
						options={groupOptions}
						placeholder={t('common.none')}
					/>
					<Input label={t('customers.notes')} bind:value={editNotes} />
					<div class="flex gap-2">
						<Button variant="ghost" onclick={() => (editing = false)}>{t('common.cancel')}</Button>
						<Button onclick={saveEdit} loading={saving} full>{t('common.save')}</Button>
					</div>
				</div>
			{:else}
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="detail-name">{selected.name}</h3>
							{#if selected.group_tag}
								<Badge variant={groupVariant(selected.group_tag)}>
									{t('customerGroup.' + selected.group_tag)}
								</Badge>
							{/if}
						</div>
						{#if selected.phone}
							<p class="detail-phone">{selected.phone}</p>
						{/if}
						<p class="detail-source">{t('customerSource.' + selected.source)}</p>
						{#if selected.notes}
							<p class="detail-notes">{selected.notes}</p>
						{/if}
					</div>
					<Button variant="secondary" size="sm" onclick={startEdit}>{t('common.edit')}</Button>
				</div>

				<!-- Stats row -->
				<div class="stats grid grid-cols-3 gap-2">
					<div class="stat">
						<span class="stat-label">{t('customers.purchases')}</span>
						<span class="stat-value tabular-nums">{selected.purchase_count}</span>
					</div>
					<div class="stat">
						<span class="stat-label">{t('customers.totalSpent')}</span>
						<span class="stat-value tabular-nums">{formatUsd(selected.total_spent_usd)}</span>
					</div>
					<div class="stat">
						<span class="stat-label">{t('customers.lastPurchase')}</span>
						<span class="stat-value-sm">
							{selected.last_purchase_at
								? formatDate(selected.last_purchase_at)
								: t('customers.never')}
						</span>
					</div>
				</div>
			{/if}

			<!-- Credit balance -->
			<div class="credit-box flex flex-col gap-3">
				<div class="flex items-center justify-between gap-2">
					<span class="credit-label">{t('customers.creditBalance')}</span>
					<span class="credit-value tabular-nums" class:owes={selected.credit_balance_usd > 0}>
						{formatUsd(selected.credit_balance_usd)}
					</span>
				</div>
				{#if selected.credit_balance_usd > 0 && !payOpen}
					<Button variant="secondary" size="sm" onclick={openPayment}>
						{t('customers.registerPayment')}
					</Button>
				{/if}
				{#if payOpen}
					<div class="flex flex-col gap-2">
						<Input
							label={t('customers.paymentAmount')}
							bind:value={payAmount}
							type="text"
							inputmode="decimal"
							error={payError}
						/>
						<div class="flex gap-2">
							<Button variant="ghost" size="sm" onclick={() => (payOpen = false)}>
								{t('common.cancel')}
							</Button>
							<Button size="sm" onclick={registerPayment} loading={payingSaving} full>
								{t('common.confirm')}
							</Button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Order history -->
			<div class="flex flex-col gap-2">
				<span class="section-title">{t('customers.orderHistory')}</span>
				{#if historyLoading}
					<div class="flex justify-center py-4">
						<LoadingSpinner size="sm" />
					</div>
				{:else if history.length === 0}
					<p class="empty-line">{t('customers.noOrders')}</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each history as o (o.id)}
							<OrderCard order={o} />
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</Modal>

<!-- ── Add modal ─────────────────────────────────────────────────────────────── -->
<Modal bind:open={addOpen} title={t('customers.add')}>
	<div class="flex flex-col gap-3">
		<Input label={t('customers.name')} bind:value={addName} error={addError} />
		<Input label={t('customers.phone')} bind:value={addPhone} type="tel" inputmode="tel" />
		<Select label={t('customers.source')} bind:value={addSource} options={sourceOptions} />
		<Select
			label={t('customers.group')}
			bind:value={addGroup}
			options={groupOptions}
			placeholder={t('common.none')}
		/>
		<Input label={t('customers.notes')} bind:value={addNotes} />
		<div class="flex gap-2 pt-1">
			<Button variant="ghost" onclick={() => (addOpen = false)}>{t('common.cancel')}</Button>
			<Button onclick={createCustomer} loading={addSaving} full>{t('common.save')}</Button>
		</div>
	</div>
</Modal>

<style>
	.card-btn {
		display: block;
		border-radius: var(--radius-lg);
		transition: transform 150ms ease;
		font-family: var(--font-sans);
	}
	.card-btn:active {
		transform: scale(0.98);
	}

	.cust-name {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 1.0625rem;
		color: var(--color-text-primary);
	}

	.cust-phone {
		margin-top: 2px;
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}

	.meta {
		margin-top: 8px;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
	}
	.meta-item {
		color: var(--color-text-secondary);
	}
	.num {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.owes {
		margin-top: 8px;
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 0.875rem;
		color: var(--color-danger);
	}

	.fab {
		position: fixed;
		right: 16px;
		bottom: 80px;
		width: 56px;
		height: 56px;
		display: grid;
		place-items: center;
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

	/* Detail */
	.detail-name {
		margin: 0;
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}
	.detail-phone {
		margin-top: 2px;
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
	}
	.detail-source {
		margin-top: 2px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}
	.detail-notes {
		margin-top: 8px;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
		white-space: pre-wrap;
	}

	.stats {
		border-top: 1px solid var(--color-surface-overlay);
		border-bottom: 1px solid var(--color-surface-overlay);
		padding: 12px 0;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat-label {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}
	.stat-value {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1.0625rem;
		color: var(--color-text-primary);
	}
	.stat-value-sm {
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--color-text-primary);
	}

	.credit-box {
		background: var(--color-surface-base);
		border-radius: var(--radius-md);
		padding: 12px;
	}
	.credit-label {
		font-family: var(--font-sans);
		font-weight: 600;
		color: var(--color-text-secondary);
	}
	.credit-value {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1.125rem;
		color: var(--color-text-primary);
	}
	.credit-value.owes {
		color: var(--color-danger);
	}

	.section-title {
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 0.9375rem;
		color: var(--color-text-primary);
	}
	.empty-line {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		color: var(--color-text-muted);
		padding: 8px 0;
	}
</style>
