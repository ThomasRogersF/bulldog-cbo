import { describe, it, expect } from 'vitest';
import { addToCart, cartCount, cartSubtotal, removeFromCart, setQty } from './cart';
import type { MenuItem } from '../types';

function item(id: string, price: number): MenuItem {
	return {
		id,
		category_id: null,
		name: 'X',
		description: null,
		price_usd: price,
		is_available: true,
		image_url: null,
		sort_order: 0,
		category_name: null,
		category_color: null,
		category_emoji: null,
		created_at: '',
		updated_at: '',
		deleted_at: null
	};
}

describe('cart reducers', () => {
	it('merges the same item and increments qty', () => {
		let items = addToCart([], item('a', 5));
		items = addToCart(items, item('a', 5));
		expect(items).toHaveLength(1);
		expect(items[0].qty).toBe(2);
	});

	it('setQty to 0 removes the line', () => {
		const items = setQty([{ menuItem: item('a', 5), qty: 3 }], 'a', 0);
		expect(items).toHaveLength(0);
	});

	it('removeFromCart drops the line', () => {
		const items = removeFromCart([{ menuItem: item('a', 5), qty: 1 }], 'a');
		expect(items).toHaveLength(0);
	});

	it('computes subtotal and count', () => {
		const items = [
			{ menuItem: item('a', 5), qty: 2 },
			{ menuItem: item('b', 3), qty: 1 }
		];
		expect(cartSubtotal(items)).toBe(13);
		expect(cartCount(items)).toBe(3);
	});

	it('keeps override lines separate from plain lines', () => {
		let items = addToCart([], item('a', 5));
		items = addToCart(items, item('a', 5), 'sin stock');
		expect(items).toHaveLength(2);
	});
});
