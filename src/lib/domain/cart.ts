// Pure cart reducers — the cart store wraps these in $state. Node-testable.
import type { CartItem, CartLineInput, MenuItem, MenuItemSnapshot } from '../types';
import { round2 } from './money';

// Plain lines merge by menu-item id; override lines (audited oversells) stay separate.
export function addToCart(
	items: CartItem[],
	menuItem: MenuItem,
	overrideReason?: string
): CartItem[] {
	if (!overrideReason) {
		const existing = items.find((i) => i.menuItem.id === menuItem.id && !i.overrideReason);
		if (existing) {
			return items.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
		}
	}
	return [...items, { menuItem, qty: 1, overrideReason }];
}

export function setQty(items: CartItem[], menuItemId: string, qty: number): CartItem[] {
	if (qty <= 0) return items.filter((i) => i.menuItem.id !== menuItemId);
	return items.map((i) => (i.menuItem.id === menuItemId ? { ...i, qty } : i));
}

export function removeFromCart(items: CartItem[], menuItemId: string): CartItem[] {
	return items.filter((i) => i.menuItem.id !== menuItemId);
}

export function cartSubtotal(items: CartItem[]): number {
	return round2(items.reduce((sum, i) => sum + i.menuItem.price_usd * i.qty, 0));
}

export function cartCount(items: CartItem[]): number {
	return items.reduce((sum, i) => sum + i.qty, 0);
}

export function snapshotOf(menuItem: MenuItem): MenuItemSnapshot {
	return {
		name: menuItem.name,
		price_usd: menuItem.price_usd,
		category_name: menuItem.category_name ?? null
	};
}

export function toLineInputs(items: CartItem[]): CartLineInput[] {
	return items.map((i) => ({
		menuItemId: i.menuItem.id,
		snapshot: snapshotOf(i.menuItem),
		qty: i.qty,
		unitPriceUsd: i.menuItem.price_usd,
		overrideReason: i.overrideReason
	}));
}
