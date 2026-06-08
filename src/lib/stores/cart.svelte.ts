// POS cart — in-memory until the first park/confirm materializes a DB order.
import { addToCart, cartCount, cartSubtotal, removeFromCart, setQty } from '$lib/domain/cart';
import { round2 } from '$lib/domain/money';
import type { CartItem, MenuItem, OrderType } from '$lib/types';

export const cartStore = $state({
	items: [] as CartItem[],
	orderType: 'takeout' as OrderType,
	customerId: null as string | null,
	orderId: null as string | null,
	notes: '',
	discount: 0
});

export function addItem(menuItem: MenuItem, overrideReason?: string): void {
	cartStore.items = addToCart(cartStore.items, menuItem, overrideReason);
}

export function updateQty(menuItemId: string, qty: number): void {
	cartStore.items = setQty(cartStore.items, menuItemId, qty);
}

export function removeItem(menuItemId: string): void {
	cartStore.items = removeFromCart(cartStore.items, menuItemId);
}

export function clearCart(): void {
	cartStore.items = [];
	cartStore.orderId = null;
	cartStore.customerId = null;
	cartStore.notes = '';
	cartStore.discount = 0;
	cartStore.orderType = 'takeout';
}

// Live derived totals — getters read cartStore reactively in templates/$derived.
export const cartSummary = {
	get subtotal(): number {
		return cartSubtotal(cartStore.items);
	},
	get total(): number {
		return round2(Math.max(0, cartSubtotal(cartStore.items) - cartStore.discount));
	},
	get count(): number {
		return cartCount(cartStore.items);
	}
};
