<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type {
		MenuCategory,
		MenuItem,
		PaymentMethod,
		CustomerStats,
		OrderWithItems
	} from '$lib/types';
	import { menuDb, ingredientsDb, ordersDb, customersDb, settingsDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import { formatUsd, formatBs } from '$lib/utils/format';
	import { toLineInputs } from '$lib/domain/cart';
	import {
		cartStore,
		addItem,
		updateQty,
		removeItem,
		clearCart,
		cartSummary
	} from '$lib/stores/cart.svelte';
	import { shiftStore } from '$lib/stores/shift.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { dataVersion, track } from '$lib/stores/realtime.svelte';

	import Button from '$lib/components/Button.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Input from '$lib/components/Input.svelte';
	import OrderTypeToggle from '$lib/components/OrderTypeToggle.svelte';
	import PaymentMethodGrid from '$lib/components/PaymentMethodGrid.svelte';
	import MenuItemCard from '$lib/components/MenuItemCard.svelte';
	import CartLine from '$lib/components/CartLine.svelte';
	import OrderCard from '$lib/components/OrderCard.svelte';

	// ── Loaded data ────────────────────────────────────────────────────────────
	let loading = $state(true);
	let categories = $state<MenuCategory[]>([]);
	let items = $state<MenuItem[]>([]);
	const outOfStockIds = new SvelteSet<string>();
	let usdRate = $state(0);

	// ── Local UI state ───────────────────────────────────────────────────────────
	let selectedCategoryId = $state<string | null>(null);
	let payment = $state<PaymentMethod | null>(null);
	let discountText = $state('');

	let cartOpen = $state(false);
	let customerModalOpen = $state(false);
	let existingModalOpen = $state(false);
	let clearConfirmOpen = $state(false);

	let customers = $state<CustomerStats[]>([]);
	let customersLoading = $state(false);
	let openOrders = $state<OrderWithItems[]>([]);
	let openOrdersLoading = $state(false);

	// Override flow
	let overrideOpen = $state(false);
	let overrideItem = $state<MenuItem | null>(null);
	let overrideReason = $state('');

	// Confirm / submit
	let submitting = $state(false);
	let parking = $state(false);
	let successOrderNumber = $state<number | null>(null);

	// ── Load menu + stock + recipes; compute the out-of-stock set ─────────────────
	async function load(): Promise<void> {
		try {
			const [cats, menuItems, stock, recipes] = await Promise.all([
				menuDb.categories.list(),
				menuDb.items.list(),
				ingredientsDb.stock.getAll(),
				menuDb.recipes.listAll()
			]);
			categories = cats;
			items = menuItems;

			// ingredient_id -> current_stock
			const stockMap = new SvelteMap<string, number>();
			for (const s of stock) stockMap.set(s.id, s.current_stock);

			// menu_item_id -> ingredient_ids[]
			const recipesByItem = new SvelteMap<string, string[]>();
			for (const r of recipes) {
				const list = recipesByItem.get(r.menu_item_id) ?? [];
				list.push(r.ingredient_id);
				recipesByItem.set(r.menu_item_id, list);
			}

			outOfStockIds.clear();
			for (const [menuItemId, ingredientIds] of recipesByItem) {
				const anyEmpty = ingredientIds.some((id) => (stockMap.get(id) ?? 0) <= 0);
				if (anyEmpty) outOfStockIds.add(menuItemId);
			}
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loading = false;
		}
	}

	async function loadRate(): Promise<void> {
		try {
			const raw = await settingsDb.get('usd_rate');
			usdRate = Number(raw) || 0;
		} catch {
			usdRate = 0;
		}
	}

	// Load rate once on mount.
	$effect(() => {
		void loadRate();
	});

	// Load menu/stock on mount and live-refresh when stock or orders change.
	$effect(() => {
		track(dataVersion.ledger, dataVersion.orders);
		void load();
	});

	// ── Derived ──────────────────────────────────────────────────────────────────
	const visibleItems = $derived(
		selectedCategoryId === null ? items : items.filter((i) => i.category_id === selectedCategoryId)
	);

	const selectedCustomerName = $derived(
		cartStore.customerId
			? (customers.find((c) => c.id === cartStore.customerId)?.name ?? t('pos.customer'))
			: null
	);

	const totalBs = $derived(usdRate > 0 ? cartSummary.total * usdRate : 0);
	const canConfirm = $derived(cartStore.items.length > 0 && payment !== null);

	// Keep cartStore.discount synced from the text input.
	$effect(() => {
		const parsed = Number(discountText.replace(',', '.'));
		cartStore.discount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	});

	// ── Add-to-cart with out-of-stock override gate ──────────────────────────────
	function handleAdd(item: MenuItem): void {
		if (outOfStockIds.has(item.id)) {
			overrideItem = item;
			overrideReason = '';
			overrideOpen = true;
			return;
		}
		addItem(item);
	}

	function confirmOverride(): void {
		if (overrideItem && overrideReason.trim()) {
			addItem(overrideItem, overrideReason.trim());
		}
		overrideOpen = false;
		overrideItem = null;
		overrideReason = '';
	}

	// ── Customer picker ──────────────────────────────────────────────────────────
	async function openCustomerModal(): Promise<void> {
		customerModalOpen = true;
		if (customers.length === 0) {
			customersLoading = true;
			try {
				customers = await customersDb.list();
			} catch {
				toast.error(t('toasts.loadFailed'));
			} finally {
				customersLoading = false;
			}
		}
	}

	function pickCustomer(id: string | null): void {
		cartStore.customerId = id;
		customerModalOpen = false;
	}

	// ── Add to existing open order ───────────────────────────────────────────────
	async function openExistingModal(): Promise<void> {
		existingModalOpen = true;
		openOrdersLoading = true;
		try {
			openOrders = await ordersDb.listOpen();
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			openOrdersLoading = false;
		}
	}

	function loadExistingOrder(order: OrderWithItems): void {
		clearCart();
		cartStore.orderId = order.id;
		cartStore.orderType = order.order_type;
		cartStore.customerId = order.customer_id;
		cartStore.notes = order.notes ?? '';
		for (const oi of order.items) {
			const menuItem =
				items.find((m) => m.id === oi.menu_item_id) ??
				({
					id: oi.menu_item_id ?? oi.id,
					category_id: null,
					name: oi.menu_item_snapshot.name,
					description: null,
					price_usd: oi.unit_price_usd,
					is_available: true,
					image_url: null,
					sort_order: 0,
					category_name: oi.menu_item_snapshot.category_name,
					category_color: null,
					category_emoji: null,
					created_at: '',
					updated_at: '',
					deleted_at: null
				} satisfies MenuItem);
			for (let n = 0; n < oi.qty; n++) {
				addItem(menuItem, oi.override_reason ?? undefined);
			}
		}
		existingModalOpen = false;
		cartOpen = true;
	}

	// ── Confirm / park ───────────────────────────────────────────────────────────
	async function confirmOrder(): Promise<void> {
		if (!canConfirm || payment === null) return;
		submitting = true;
		try {
			let orderNumber: number;
			if (cartStore.orderId === null) {
				const order = await ordersDb.create({
					orderType: cartStore.orderType,
					customerId: cartStore.customerId,
					notes: cartStore.notes,
					items: toLineInputs(cartStore.items)
				});
				const confirmed = await ordersDb.confirm(order.id, {
					method: payment,
					discountUsd: cartStore.discount
				});
				orderNumber = confirmed.order_number;
			} else {
				const confirmed = await ordersDb.confirm(cartStore.orderId, {
					method: payment,
					discountUsd: cartStore.discount
				});
				orderNumber = confirmed.order_number;
			}
			toast.success(t('toasts.orderConfirmed'));
			successOrderNumber = orderNumber;
			cartOpen = false;
			setTimeout(() => {
				clearCart();
				payment = null;
				discountText = '';
				successOrderNumber = null;
			}, 2000);
		} catch {
			toast.error(t('toasts.confirmFailed'));
		} finally {
			submitting = false;
		}
	}

	async function parkOrder(): Promise<void> {
		if (cartStore.items.length === 0) return;
		parking = true;
		try {
			await ordersDb.create({
				orderType: cartStore.orderType,
				customerId: cartStore.customerId,
				notes: cartStore.notes,
				items: toLineInputs(cartStore.items)
			});
			toast.success(t('toasts.orderParked'));
			clearCart();
			payment = null;
			discountText = '';
			cartOpen = false;
		} catch {
			toast.error(t('toasts.confirmFailed'));
		} finally {
			parking = false;
		}
	}

	function doClearCart(): void {
		clearCart();
		payment = null;
		discountText = '';
	}
</script>

{#if loading}
	<div class="flex min-h-[60vh] items-center justify-center">
		<LoadingSpinner size="lg" />
	</div>
{:else if !shiftStore.active}
	<div class="flex min-h-[70vh] items-center justify-center p-4">
		<EmptyState icon="🕐" title={t('pos.noOpenShift')} subtitle={t('pos.noOpenShiftHint')}>
			{#snippet action()}
				<Button size="lg" onclick={() => goto(resolve('/shifts'))}>{t('pos.openShiftCta')}</Button>
			{/snippet}
		</EmptyState>
	</div>
{:else}
	<div class="pos-grid">
		<!-- ── LEFT: menu ─────────────────────────────────────────────────────── -->
		<section class="menu-panel flex min-w-0 flex-col gap-3">
			<h1 class="screen-title">{t('pos.title')}</h1>

			<!-- Category pills -->
			<div class="pills flex gap-2 overflow-x-auto pb-1" role="tablist">
				<button
					type="button"
					class="pill"
					class:selected={selectedCategoryId === null}
					onclick={() => (selectedCategoryId = null)}
				>
					{t('pos.allCategories')}
				</button>
				{#each categories as cat (cat.id)}
					<button
						type="button"
						class="pill"
						class:selected={selectedCategoryId === cat.id}
						style="--pill-color: {cat.color};"
						onclick={() => (selectedCategoryId = cat.id)}
					>
						{#if cat.emoji}<span aria-hidden="true">{cat.emoji}</span>{/if}
						<span>{cat.name}</span>
					</button>
				{/each}
			</div>

			<!-- Menu grid -->
			{#if visibleItems.length === 0}
				<EmptyState icon="🌭" title={t('menu.noItems')} />
			{:else}
				<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
					{#each visibleItems as item (item.id)}
						<MenuItemCard {item} outOfStock={outOfStockIds.has(item.id)} onadd={handleAdd} />
					{/each}
				</div>
			{/if}
		</section>

		<!-- ── RIGHT: cart (sidebar on >=768px) ───────────────────────────────── -->
		<aside class="cart-panel hidden md:flex md:flex-col">
			{@render cartContent()}
		</aside>
	</div>

	<!-- ── Mobile sticky cart bar ──────────────────────────────────────────── -->
	<div class="cart-bar md:hidden">
		<button type="button" class="cart-bar-btn" onclick={() => (cartOpen = true)}>
			<span class="cart-bar-count tabular-nums">{cartSummary.count}</span>
			<span class="cart-bar-total tabular-nums">{formatUsd(cartSummary.total)}</span>
			<span class="cart-bar-cta">{t('pos.cart')} →</span>
		</button>
	</div>

	<!-- ── Mobile cart sheet ───────────────────────────────────────────────── -->
	<div class="md:hidden">
		<BottomSheet bind:open={cartOpen} title={t('pos.cart')}>
			{@render cartContent()}
		</BottomSheet>
	</div>

	<!-- ── Customer picker modal ──────────────────────────────────────────── -->
	<Modal bind:open={customerModalOpen} title={t('pos.selectCustomer')}>
		{#if customersLoading}
			<div class="flex justify-center p-6"><LoadingSpinner /></div>
		{:else}
			<div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
				<button type="button" class="customer-row" onclick={() => pickCustomer(null)}>
					{t('pos.noCustomer')}
				</button>
				{#each customers as c (c.id)}
					<button type="button" class="customer-row" onclick={() => pickCustomer(c.id)}>
						<span class="customer-name">{c.name}</span>
						{#if c.phone}<span class="customer-sub">{c.phone}</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	</Modal>

	<!-- ── Add to existing order modal ────────────────────────────────────── -->
	<Modal bind:open={existingModalOpen} title={t('pos.selectOrder')}>
		{#if openOrdersLoading}
			<div class="flex justify-center p-6"><LoadingSpinner /></div>
		{:else if openOrders.length === 0}
			<EmptyState icon="📭" title={t('orders.noOpen')} subtitle={t('orders.noOpenHint')} />
		{:else}
			<div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
				{#each openOrders as order (order.id)}
					<OrderCard {order} showElapsed onclick={() => loadExistingOrder(order)} />
				{/each}
			</div>
		{/if}
	</Modal>

	<!-- ── Override modal ─────────────────────────────────────────────────── -->
	<Modal bind:open={overrideOpen} title={t('pos.overrideTitle')}>
		<p class="override-msg">
			{(overrideItem?.name ?? '') + ' ' + t('pos.overridePrompt')}
		</p>
		<Input
			label={t('pos.overrideReason')}
			bind:value={overrideReason}
			placeholder={t('pos.overrideReasonPlaceholder')}
		/>
		<div class="override-footer">
			<Button variant="ghost" onclick={() => (overrideOpen = false)}>{t('common.cancel')}</Button>
			<Button variant="danger" disabled={!overrideReason.trim()} onclick={confirmOverride}>
				{t('pos.overrideContinue')}
			</Button>
		</div>
	</Modal>

	<!-- ── Clear-cart confirm ─────────────────────────────────────────────── -->
	<ConfirmDialog
		bind:open={clearConfirmOpen}
		title={t('pos.clearCart')}
		message={t('pos.clearConfirm')}
		confirmLabel={t('pos.clearCart')}
		danger
		onconfirm={doClearCart}
	/>

	<!-- ── Success overlay ────────────────────────────────────────────────── -->
	{#if successOrderNumber !== null}
		<div class="success-overlay" role="status" aria-live="polite">
			<div class="success-card">
				<span class="success-check" aria-hidden="true">✓</span>
				<p class="success-title">{t('pos.orderConfirmed')}</p>
				<p class="success-number tabular-nums">{t('orders.number')} #{successOrderNumber}</p>
			</div>
		</div>
	{/if}
{/if}

<!-- ── Reusable cart content (sidebar + sheet) ────────────────────────────── -->
{#snippet cartContent()}
	<div class="cart-inner flex h-full flex-col gap-3">
		<OrderTypeToggle bind:value={cartStore.orderType} />

		<!-- Customer selector -->
		<button type="button" class="customer-btn" onclick={openCustomerModal}>
			<span class="customer-btn-label">{t('pos.customer')}</span>
			<span class="customer-btn-value">{selectedCustomerName ?? t('pos.noCustomer')}</span>
		</button>

		<!-- Cart lines -->
		<div class="cart-lines flex-1 overflow-y-auto">
			{#if cartStore.items.length === 0}
				<EmptyState icon="🛒" title={t('pos.emptyCart')} subtitle={t('pos.emptyCartHint')} />
			{:else}
				<div class="flex flex-col">
					{#each cartStore.items as line (line.menuItem.id + (line.overrideReason ?? ''))}
						<CartLine
							name={line.menuItem.name}
							qty={line.qty}
							lineTotal={line.menuItem.price_usd * line.qty}
							override={!!line.overrideReason}
							oninc={() => updateQty(line.menuItem.id, line.qty + 1)}
							ondec={() => updateQty(line.menuItem.id, line.qty - 1)}
							onremove={() => removeItem(line.menuItem.id)}
						/>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Totals + payment -->
		{#if cartStore.items.length > 0}
			<div class="cart-totals flex flex-col gap-3">
				<Input
					label={t('pos.discount')}
					type="number"
					inputmode="decimal"
					bind:value={discountText}
					placeholder="0.00"
				/>

				<div class="totals-box flex flex-col gap-1">
					<div class="total-row flex items-center justify-between">
						<span class="total-label">{t('pos.subtotal')}</span>
						<span class="total-val tabular-nums">{formatUsd(cartSummary.subtotal)}</span>
					</div>
					{#if cartStore.discount > 0}
						<div class="total-row flex items-center justify-between">
							<span class="total-label">{t('pos.discount')}</span>
							<span class="total-val tabular-nums">−{formatUsd(cartStore.discount)}</span>
						</div>
					{/if}
					<div class="total-row grand flex items-center justify-between">
						<span class="total-label">{t('pos.total')}</span>
						<span class="total-val tabular-nums">{formatUsd(cartSummary.total)}</span>
					</div>
					{#if usdRate > 0}
						<div class="total-row flex items-center justify-between">
							<span class="rate-badge"
								>{t('pos.usdRate')}: <span class="tabular-nums">{usdRate}</span></span
							>
							<span class="bs-val tabular-nums">{formatBs(totalBs)}</span>
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-1.5">
					<span class="section-label">{t('pos.paymentMethod')}</span>
					<PaymentMethodGrid bind:value={payment} />
				</div>
			</div>
		{/if}

		<!-- Actions -->
		<div class="cart-actions flex flex-col gap-2">
			<Button size="lg" full loading={submitting} disabled={!canConfirm} onclick={confirmOrder}>
				{t('pos.confirmOrder')}
			</Button>
			<div class="flex gap-2">
				<Button variant="secondary" full loading={parking} onclick={parkOrder}>
					{t('pos.parkOrder')}
				</Button>
				<Button variant="ghost" full onclick={openExistingModal}>
					{t('pos.addToExisting')}
				</Button>
			</div>
			{#if cartStore.items.length > 0}
				<Button variant="ghost" full onclick={() => (clearConfirmOpen = true)}>
					{t('pos.clearCart')}
				</Button>
			{/if}
		</div>
	</div>
{/snippet}

<style>
	.screen-title {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.pos-grid {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		padding-bottom: 88px; /* room for the mobile cart bar */
	}

	.menu-panel {
		flex: 1;
	}

	@media (min-width: 768px) {
		.pos-grid {
			flex-direction: row;
			align-items: flex-start;
			padding-bottom: 16px;
			height: calc(100vh - 0px);
		}
		.menu-panel {
			flex: 0 0 60%;
			max-width: 60%;
			overflow-y: auto;
			max-height: calc(100vh - 32px);
		}
		.cart-panel {
			flex: 0 0 40%;
			max-width: 40%;
			position: sticky;
			top: 16px;
			max-height: calc(100vh - 32px);
			background: var(--color-surface-raised);
			border-radius: var(--radius-lg);
			box-shadow:
				0 1px 3px rgba(0, 0, 0, 0.1),
				0 1px 2px rgba(0, 0, 0, 0.06);
			padding: 16px;
		}
	}

	/* Category pills */
	.pills {
		scrollbar-width: none;
	}
	.pills::-webkit-scrollbar {
		display: none;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: 0 0 auto;
		min-height: 48px;
		padding: 0 16px;
		border: 2px solid var(--color-surface-overlay);
		border-radius: var(--radius-full);
		background: var(--color-surface-raised);
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 0.9375rem;
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
	.pill.selected {
		border-color: var(--pill-color, var(--color-accent));
		background: var(--pill-color, var(--color-accent));
		color: var(--color-accent-fg);
	}

	/* Cart inner */
	.cart-inner {
		min-height: 0;
	}

	.customer-btn {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-height: 48px;
		padding: 8px 12px;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
		font-family: var(--font-sans);
		text-align: left;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			transform 150ms ease;
	}
	.customer-btn:active {
		transform: scale(0.98);
	}
	.customer-btn-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-muted);
	}
	.customer-btn-value {
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.cart-lines {
		min-height: 120px;
	}

	/* Totals */
	.totals-box {
		padding: 12px;
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
	}
	.total-row {
		font-family: var(--font-sans);
	}
	.total-label {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}
	.total-val {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-primary);
	}
	.total-row.grand {
		margin-top: 4px;
		padding-top: 8px;
		border-top: 1px solid var(--color-surface-overlay);
	}
	.total-row.grand .total-label {
		font-size: 1.0625rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.total-row.grand .total-val {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-accent);
	}
	.rate-badge {
		font-size: 12px;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}
	.bs-val {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.section-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
	}

	.cart-actions {
		padding-top: 4px;
	}

	/* Mobile sticky cart bar */
	.cart-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 8px 12px;
		background: var(--color-surface-raised);
		box-shadow:
			0 -4px 6px rgba(0, 0, 0, 0.1),
			0 -2px 4px rgba(0, 0, 0, 0.06);
	}
	.cart-bar-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		padding: 0 16px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-family: var(--font-sans);
		font-weight: 700;
		cursor: pointer;
		transition: transform 150ms ease;
	}
	.cart-bar-btn:active {
		transform: scale(0.98);
	}
	.cart-bar-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 8px;
		border-radius: var(--radius-full);
		background: var(--color-secondary);
		color: var(--color-secondary-fg);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}
	.cart-bar-total {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 1.0625rem;
	}
	.cart-bar-cta {
		font-size: 0.9375rem;
		opacity: 0.9;
	}

	/* Customer rows */
	.customer-row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		width: 100%;
		min-height: 48px;
		padding: 10px 12px;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
		font-family: var(--font-sans);
		text-align: left;
		cursor: pointer;
		transition:
			background 150ms ease,
			transform 150ms ease;
	}
	.customer-row:active {
		transform: scale(0.98);
	}
	.customer-name {
		font-weight: 600;
		color: var(--color-text-primary);
	}
	.customer-sub {
		font-size: 13px;
		color: var(--color-text-muted);
	}

	/* Override modal */
	.override-msg {
		margin: 0 0 16px 0;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
		line-height: 1.5;
	}
	.override-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 20px;
	}

	/* Success overlay */
	.success-overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-overlay);
		backdrop-filter: blur(2px);
		animation: fade-in 150ms ease;
	}
	.success-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 32px 40px;
		border-radius: var(--radius-xl);
		background: var(--color-surface-raised);
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.12),
			0 4px 8px rgba(0, 0, 0, 0.08);
		font-family: var(--font-sans);
		animation: pop 200ms ease;
	}
	.success-check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		border-radius: var(--radius-full);
		background: var(--color-success);
		color: var(--color-success-fg);
		font-size: 40px;
		font-weight: 700;
	}
	.success-title {
		margin: 8px 0 0 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.success-number {
		margin: 0;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
