import { describe, it, expect } from 'vitest';
import { currentStock, isLowStock, isOutOfStock, stockLevel, stockRatio } from './stock';

describe('currentStock', () => {
	it('sums ledger movements', () => {
		expect(currentStock([{ qty_change: 100 }, { qty_change: -30 }, { qty_change: -5 }])).toBe(65);
	});
});

describe('thresholds', () => {
	it('flags low and out at/under the limits', () => {
		expect(isLowStock(5, 5)).toBe(true);
		expect(isLowStock(6, 5)).toBe(false);
		expect(isOutOfStock(0)).toBe(true);
		expect(isOutOfStock(1)).toBe(false);
	});
	it('classifies the level', () => {
		expect(stockLevel(0, 5)).toBe('out');
		expect(stockLevel(3, 5)).toBe('low');
		expect(stockLevel(20, 5)).toBe('ok');
	});
});

describe('stockRatio', () => {
	it('clamps to 0..1', () => {
		expect(stockRatio(0, 5)).toBe(0);
		expect(stockRatio(100, 5)).toBe(1);
	});
});
