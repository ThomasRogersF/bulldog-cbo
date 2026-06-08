import { describe, it, expect } from 'vitest';
import { computeTotals, expectedCash, lineTotal, round2, variance } from './money';

describe('round2', () => {
	it('kills binary float noise', () => {
		expect(round2(0.1 + 0.2)).toBe(0.3);
		expect(round2(2.345)).toBe(2.35);
	});
});

describe('lineTotal', () => {
	it('multiplies and rounds', () => {
		expect(lineTotal(1.5, 3)).toBe(4.5);
	});
});

describe('computeTotals', () => {
	it('applies discount and converts to Bs', () => {
		const r = computeTotals([10, 5.5], 0.5, 40);
		expect(r.subtotalUsd).toBe(15.5);
		expect(r.totalUsd).toBe(15);
		expect(r.totalBs).toBe(600);
	});
	it('never goes below zero', () => {
		expect(computeTotals([5], 10, 40).totalUsd).toBe(0);
	});
});

describe('drawer reconciliation', () => {
	it('expected = opening + cash sales; variance = closing - expected', () => {
		expect(expectedCash(50, 120)).toBe(170);
		expect(variance(165, 170)).toBe(-5);
	});
});
