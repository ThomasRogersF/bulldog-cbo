import { describe, it, expect } from 'vitest';
import { formatBs, formatDuration, formatQty, formatUsd } from './format';

describe('formatUsd', () => {
	it('formats with grouping, 2 decimals, and a $ prefix', () => {
		expect(formatUsd(5)).toBe('$5.00');
		expect(formatUsd(1234.5)).toBe('$1,234.50');
		expect(formatUsd(null)).toBe('$0.00');
	});
});

describe('formatBs', () => {
	it('appends the Bs suffix', () => {
		expect(formatBs(40)).toContain('Bs');
	});
});

describe('formatQty', () => {
	it('shows integers without decimals', () => {
		expect(formatQty(3)).toBe('3');
	});
	it('appends the unit label for non-unit measures', () => {
		expect(formatQty(2, 'kg')).toBe('2 kg');
	});
});

describe('formatDuration', () => {
	it('formats minutes only', () => {
		const from = new Date('2026-06-07T10:00:00Z').toISOString();
		const to = new Date('2026-06-07T10:45:00Z').toISOString();
		expect(formatDuration(from, to)).toBe('45m');
	});
	it('formats hours and minutes', () => {
		const from = new Date('2026-06-07T08:00:00Z').toISOString();
		const to = new Date('2026-06-07T10:30:00Z').toISOString();
		expect(formatDuration(from, to)).toBe('2h 30m');
	});
});
