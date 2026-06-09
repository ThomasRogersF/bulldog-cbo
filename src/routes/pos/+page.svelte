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
	import Icon from '$lib/components/Icon.svelte';
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
	let searchText = $state('');
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
	const visibleItems = $derived.by(() => {
		const q = searchText.trim().toLowerCase();
		return items.filter((i) => {
			const inCategory = selectedCategoryId === null || i.category_id === selectedCategoryId;
			const matches = q === '' || i.name.toLowerCase().includes(q);
			return inCategory && matches;
		});
	});

	// menu_item_id -> total qty in the current cart (for the tile count badge)
	const cartQtyById = $derived.by(() => {
		const m = new SvelteMap<string, number>();
		for (const line of cartStore.items) {
			m.set(line.menuItem.id, (m.get(line.menuItem.id) ?? 0) + line.qty);
		}
		return m;
	});

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
{:else}
	<!-- ── Shift context bar (open) / warning banner (none) ──────────────────── -->
	{#if shiftStore.active}
		<div class="shift-bar">
			{t('shifts.number')} #{shiftStore.active.shift_number} ·
			<span class="tabular-nums">{shiftStore.active.confirmed_orders}</span>
			{t('pos.ordersShort')} ·
			<span class="tabular-nums">{formatUsd(shiftStore.active.total_sales_usd)}</span>
			{t('pos.soldToday')}
		</div>
	{:else}
		<div class="shift-warning" role="alert">
			<span class="shift-warning-text">
				<Icon name="alert" size={16} />
				{t('pos.noOpenShift')} · {t('pos.salesWontRegister')}
			</span>
			<button type="button" class="shift-warning-link" onclick={() => goto(resolve('/shifts'))}>
				{t('pos.openShiftCta')}
				<Icon name="arrowRight" size={15} />
			</button>
		</div>
	{/if}

	<div class="pos">
		<!-- ── LEFT: catalog ──────────────────────────────────────────────────── -->
		<section class="pos__catalog">
			<div class="pos__cat-head">
				<div class="searchbox">
					<Icon name="search" size={17} />
					<input placeholder={t('common.search') + '…'} bind:value={searchText} />
				</div>
				<span class="pos__count tabular-nums"
					>{visibleItems.length} {t('common.of')} {items.length}</span
				>
			</div>

			<!-- Category pills -->
			<div class="tabs" role="tablist">
				<button
					type="button"
					class="pill"
					class:pill--on={selectedCategoryId === null}
					onclick={() => (selectedCategoryId = null)}
				>
					{t('pos.allCategories')}
				</button>
				{#each categories as cat (cat.id)}
					<button
						type="button"
						class="pill"
						class:pill--on={selectedCategoryId === cat.id}
						onclick={() => (selectedCategoryId = cat.id)}
					>
						{cat.name}
					</button>
				{/each}
			</div>

			<!-- Menu grid -->
			{#if visibleItems.length === 0}
				<EmptyState icon="search" title={t('menu.noItems')} />
			{:else}
				<div class="grid">
					{#each visibleItems as item (item.id)}
						<MenuItemCard
							{item}
							outOfStock={outOfStockIds.has(item.id)}
							qtyInCart={cartQtyById.get(item.id) ?? 0}
							bsText={usdRate > 0 ? formatBs(item.price_usd * usdRate) : undefined}
							onadd={handleAdd}
						/>
					{/each}
				</div>
			{/if}
		</section>

		<!-- ── RIGHT: cart (sidebar on >=768px) ───────────────────────────────── -->
		<aside class="pos__cart hidden md:flex md:flex-col">
			{@render cartContent()}
		</aside>
	</div>

	<!-- ── Mobile sticky cart bar ──────────────────────────────────────────── -->
	<div class="cart-bar md:hidden">
		<button type="button" class="cart-bar-btn" onclick={() => (cartOpen = true)}>
			<span class="cart-bar-count tabular-nums">{cartSummary.count}</span>
			<span class="cart-bar-total tabular-nums">{formatUsd(cartSummary.total)}</span>
			<span class="cart-bar-cta">{t('pos.cart')} <Icon name="arrowRight" size={16} /></span>
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
			<EmptyState icon="receipt" title={t('orders.noOpen')} subtitle={t('orders.noOpenHint')} />
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
				<span class="success-check" aria-hidden="true"
					><Icon name="check" size={40} stroke={3} /></span
				>
				<p class="success-title">{t('pos.orderConfirmed')}</p>
				<p class="success-number tabular-nums">{t('orders.number')} #{successOrderNumber}</p>
			</div>
		</div>
	{/if}
{/if}

<!-- ── Reusable cart content (sidebar + sheet) ────────────────────────────── -->
{#snippet cartContent()}
	<div class="cart-inner">
		<OrderTypeToggle bind:value={cartStore.orderType} />

		<!-- Customer selector -->
		<button type="button" class="clientrow" onclick={openCustomerModal}>
			<span class="clientrow__l"><Icon name="users" size={16} /> {t('pos.customer')}</span>
			<span class="clientrow__v">{selectedCustomerName ?? t('pos.noCustomer')}</span>
			<Icon name={cartStore.customerId ? 'x' : 'plus'} size={16} />
		</button>

		<!-- Cart lines -->
		<div class="cart-lines">
			{#if cartStore.items.length === 0}
				<EmptyState icon="cart" title={t('pos.emptyCart')} subtitle={t('pos.emptyCartHint')} />
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
			<div class="cart-foot">
				<Input
					label={t('pos.discount')}
					type="number"
					inputmode="decimal"
					bind:value={discountText}
					placeholder="0.00"
				/>

				<div class="totals">
					<div class="totals__row">
						<span>{t('pos.subtotal')}</span>
						<span class="tabular-nums">{formatUsd(cartSummary.subtotal)}</span>
					</div>
					{#if cartStore.discount > 0}
						<div class="totals__row totals__row--disc">
							<span>{t('pos.discount')}</span>
							<span class="tabular-nums">−{formatUsd(cartStore.discount)}</span>
						</div>
					{/if}
					<div class="totals__row totals__row--grand">
						<span>{t('pos.total')}</span>
						<div class="totals__amt">
							<span class="totals__usd tabular-nums">{formatUsd(cartSummary.total)}</span>
							{#if usdRate > 0}
								<span class="totals__bs tabular-nums">{formatBs(totalBs)}</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="paysec">
					<span class="paysec__l">{t('pos.paymentMethod')}</span>
					<PaymentMethodGrid bind:value={payment} />
				</div>
			</div>
		{/if}

		<!-- Actions -->
		<div class="cart-actions">
			<Button
				size="lg"
				full
				icon="check"
				loading={submitting}
				disabled={!canConfirm}
				onclick={confirmOrder}
			>
				{cartStore.items.length === 0
					? t('pos.emptyCart')
					: `${t('pos.confirmOrder')} · ${formatUsd(cartSummary.total)}`}
			</Button>
			<div class="cart-actions__row">
				<Button
					variant="secondary"
					size="sm"
					icon="pin"
					full
					loading={parking}
					disabled={cartStore.items.length === 0}
					onclick={parkOrder}
				>
					{t('pos.parkOrder')}
				</Button>
				<Button variant="ghost" size="sm" icon="receipt" full onclick={openExistingModal}>
					{t('pos.addToExisting')}
				</Button>
			</div>
			{#if cartStore.items.length > 0}
				<Button variant="ghost" size="sm" full onclick={() => (clearConfirmOpen = true)}>
					{t('pos.clearCart')}
				</Button>
			{/if}
		</div>
	</div>
{/snippet}

<style>
	/* Shift context bar (open) — subtle strip just below the TopBar */
	.shift-bar {
		padding: 7px 26px;
		background: var(--color-surface-2);
		border-bottom: 1px solid var(--color-line);
		color: var(--color-text-dim);
		font-family: var(--font-sans);
		font-size: 12.5px;
		font-weight: 600;
		text-align: center;
	}

	/* No-shift warning banner */
	.shift-warning {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 26px;
		background: color-mix(in srgb, var(--color-red) 10%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--color-red) 22%, transparent);
		color: var(--color-red);
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 600;
	}
	.shift-warning-text {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.shift-warning-link {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		flex: 0 0 auto;
		border: none;
		background: transparent;
		color: var(--color-mustard);
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 13px;
		white-space: nowrap;
		cursor: pointer;
	}
	.shift-warning-link:hover {
		color: var(--color-mustard-deep);
	}

	/* Two-panel layout */
	.pos {
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding-bottom: 88px; /* room for the mobile cart bar */
	}

	.pos__catalog {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 20px 22px;
		min-width: 0;
	}

	.pos__cat-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
	}

	.searchbox {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: 1;
		max-width: 360px;
		padding: 11px 14px;
		background: var(--color-surface);
		border: 1px solid var(--color-line-2);
		border-radius: 11px;
		color: var(--color-text-dim);
	}
	.searchbox input {
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--color-text);
		font-family: var(--font-sans);
		font-size: 14px;
	}
	.searchbox input::placeholder {
		color: var(--color-text-faint);
	}

	.pos__count {
		font-size: 12.5px;
		color: var(--color-text-faint);
		font-weight: 600;
		white-space: nowrap;
	}

	.tabs {
		display: flex;
		gap: 9px;
		flex-wrap: wrap;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-height: 48px;
		padding: 9px 16px;
		border: 1px solid var(--color-line);
		border-radius: 9999px;
		background: var(--color-surface-2);
		color: var(--color-text-dim);
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 13.5px;
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

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
		gap: 14px;
	}

	/* Cart panel */
	.pos__cart {
		padding: 18px 18px 0;
		background: var(--color-surface);
	}

	.cart-inner {
		display: flex;
		flex-direction: column;
		min-height: 0;
		height: 100%;
	}

	.clientrow {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 48px;
		padding: 13px 14px;
		margin: 12px 0 14px;
		border: 1px solid var(--color-line);
		border-radius: 11px;
		background: var(--color-surface-2);
		color: var(--color-text);
		font-family: var(--font-sans);
		cursor: pointer;
		transition: border-color 150ms ease;
	}
	.clientrow:hover {
		border-color: var(--color-line-2);
	}
	.clientrow__l {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-dim);
		font-size: 13px;
		font-weight: 600;
	}
	.clientrow__v {
		margin-left: auto;
		font-weight: 700;
		font-size: 14px;
	}

	.cart-lines {
		flex: 1;
		min-height: 120px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	/* Totals */
	.cart-foot {
		border-top: 1px solid var(--color-line);
		padding-top: 15px;
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	.totals {
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.totals__row {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
		color: var(--color-text-dim);
		font-family: var(--font-sans);
	}
	.totals__row--disc {
		color: var(--color-green);
		font-weight: 600;
	}
	.totals__row--grand {
		align-items: flex-end;
		border-top: 1px solid var(--color-line);
		padding-top: 13px;
		margin-top: 2px;
	}
	.totals__row--grand > span {
		font-size: 18px;
		font-weight: 800;
		color: var(--color-text);
	}
	.totals__amt {
		text-align: right;
		display: flex;
		flex-direction: column;
	}
	.totals__usd {
		font-size: 27px;
		font-weight: 800;
		color: var(--color-mustard);
		letter-spacing: -0.025em;
		line-height: 1;
	}
	.totals__bs {
		font-size: 12px;
		color: var(--color-text-faint);
		margin-top: 4px;
	}

	.paysec__l {
		font-size: 13px;
		color: var(--color-text-dim);
		font-weight: 600;
		display: block;
		margin-bottom: 9px;
	}

	.cart-actions {
		position: sticky;
		bottom: 0;
		background: var(--color-surface);
		padding: 14px 0 18px;
		margin-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.cart-actions::before {
		content: '';
		position: absolute;
		top: -22px;
		left: 0;
		right: 0;
		height: 22px;
		background: linear-gradient(to top, var(--color-surface), transparent);
		pointer-events: none;
	}
	.cart-actions__row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}

	/* Desktop two-panel grid */
	@media (min-width: 768px) {
		.pos {
			display: grid;
			grid-template-columns: 1fr clamp(360px, 34%, 440px);
			align-items: start;
			padding-bottom: 0;
		}
		.pos__catalog {
			min-height: 0;
		}
		.pos__cart {
			position: sticky;
			top: 0;
			max-height: calc(100vh - 70px);
			overflow-y: auto;
			border-left: 1px solid var(--color-line);
		}
	}

	/* Mobile sticky cart bar */
	.cart-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 66px;
		z-index: 30;
		padding: 8px 12px;
		background: var(--color-surface);
		border-top: 1px solid var(--color-line);
	}
	.cart-bar-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		padding: 0 16px;
		border: none;
		border-radius: 13px;
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		font-family: var(--font-sans);
		font-weight: 800;
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
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.18);
		font-size: 0.875rem;
	}
	.cart-bar-total {
		margin-left: auto;
		font-size: 1.0625rem;
	}
	.cart-bar-cta {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.9375rem;
	}

	/* Customer rows (picker modal) */
	.customer-row {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		width: 100%;
		min-height: 48px;
		padding: 12px 14px;
		border: 1px solid var(--color-line);
		border-radius: 11px;
		background: var(--color-surface-2);
		font-family: var(--font-sans);
		text-align: left;
		cursor: pointer;
		transition: border-color 150ms ease;
	}
	.customer-row:hover {
		border-color: var(--color-line-2);
	}
	.customer-name {
		font-weight: 700;
		color: var(--color-text);
	}
	.customer-sub {
		font-size: 13px;
		color: var(--color-text-faint);
	}

	/* Override modal */
	.override-msg {
		margin: 0 0 16px 0;
		color: var(--color-text-dim);
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
		border-radius: var(--r-card);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		box-shadow: 0 24px 60px -18px rgba(0, 0, 0, 0.8);
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
		background: var(--color-green);
		color: var(--color-success-fg);
	}
	.success-title {
		margin: 8px 0 0 0;
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-text);
	}
	.success-number {
		margin: 0;
		font-weight: 700;
		color: var(--color-text-faint);
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
