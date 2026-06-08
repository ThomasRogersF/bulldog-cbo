import { describe, it, expect } from 'vitest';
import { expandRecipesToLedger } from './recipe';

describe('expandRecipesToLedger', () => {
	it('produces negative movements scaled by quantity', () => {
		const map = new Map([
			[
				'm1',
				[
					{ ingredient_id: 'i1', qty_required: 2 },
					{ ingredient_id: 'i2', qty_required: 1 }
				]
			]
		]);
		const drafts = expandRecipesToLedger([{ menu_item_id: 'm1', qty: 3 }], map);
		expect(drafts).toEqual([
			{ ingredient_id: 'i1', qty_change: -6 },
			{ ingredient_id: 'i2', qty_change: -3 }
		]);
	});

	it('skips items with no recipe or a null menu_item_id', () => {
		const map = new Map<string, { ingredient_id: string; qty_required: number }[]>();
		const drafts = expandRecipesToLedger(
			[
				{ menu_item_id: 'unknown', qty: 1 },
				{ menu_item_id: null, qty: 1 }
			],
			map
		);
		expect(drafts).toEqual([]);
	});
});
