// Stock is never a stored column — it is the running sum of ledger movements.
import type { IngredientLedgerEntry } from '../types';

export function currentStock(entries: Pick<IngredientLedgerEntry, 'qty_change'>[]): number {
	return entries.reduce((sum, e) => sum + Number(e.qty_change), 0);
}

export function isLowStock(stock: number, minStock: number): boolean {
	return stock <= minStock;
}

export function isOutOfStock(stock: number): boolean {
	return stock <= 0;
}

export type StockLevel = 'out' | 'low' | 'ok';

export function stockLevel(stock: number, minStock: number): StockLevel {
	if (isOutOfStock(stock)) return 'out';
	if (isLowStock(stock, minStock)) return 'low';
	return 'ok';
}

// 0..1 fill ratio for the visual stock bar, scaled against 2× the reorder point.
export function stockRatio(stock: number, minStock: number): number {
	const ceiling = Math.max(minStock * 2, stock, 1);
	return Math.min(1, Math.max(0, stock / ceiling));
}
