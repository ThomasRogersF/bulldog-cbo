// Expanding an order's items into stock movements at confirm time. There is no
// DB trigger doing this — the app writes the 'sale' ledger entries itself.
import type { OrderItem, Recipe } from '../types';

export interface LedgerDraft {
	ingredient_id: string;
	qty_change: number;
}

// Each order item's recipe becomes negative movements scaled by quantity.
// Items with no menu_item_id (free-form) or no recipe contribute nothing.
export function expandRecipesToLedger(
	items: Pick<OrderItem, 'menu_item_id' | 'qty'>[],
	recipesByMenuItem: Map<string, Pick<Recipe, 'ingredient_id' | 'qty_required'>[]>
): LedgerDraft[] {
	const drafts: LedgerDraft[] = [];
	for (const item of items) {
		if (!item.menu_item_id) continue;
		const recipe = recipesByMenuItem.get(item.menu_item_id);
		if (!recipe || recipe.length === 0) continue;
		for (const line of recipe) {
			drafts.push({
				ingredient_id: line.ingredient_id,
				qty_change: -(Number(line.qty_required) * Number(item.qty))
			});
		}
	}
	return drafts;
}
