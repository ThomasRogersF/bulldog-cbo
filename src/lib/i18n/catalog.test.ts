import { describe, it, expect } from 'vitest';
import { t } from './index';

// Every enum value that the UI renders through t() must resolve to a real
// translation (not the fall-through key). Catches gaps like missing payment
// methods or ledger reasons.
const PAYMENT = [
	'cash_usd',
	'cash_bs',
	'card',
	'pagomovil',
	'transfer',
	'zinli',
	'binance',
	'paypal',
	'credit'
];
const REASONS = ['sale', 'restock', 'adjustment', 'waste', 'manual_override', 'opening_count'];
const GROUPS = ['vip', 'regular', 'crew', 'wholesale'];
const SOURCES = ['walk_in', 'regular', 'delivery', 'referred', 'other'];
const TYPES = ['dine_in', 'takeout'];
const STATUS = ['open', 'confirmed', 'cancelled'];
const UNITS = ['unit', 'g', 'ml', 'kg', 'l'];

function expectAllResolve(prefix: string, keys: string[]): void {
	for (const k of keys) {
		expect(t(`${prefix}.${k}`)).not.toBe(`${prefix}.${k}`);
	}
}

describe('i18n catalog covers every enum value', () => {
	it('payment methods', () => expectAllResolve('payment', PAYMENT));
	it('ledger reasons', () => expectAllResolve('ingredientReason', REASONS));
	it('customer groups', () => expectAllResolve('customerGroup', GROUPS));
	it('customer sources', () => expectAllResolve('customerSource', SOURCES));
	it('order types', () => expectAllResolve('orderType', TYPES));
	it('order status', () => expectAllResolve('status', STATUS));
	it('units', () => expectAllResolve('units', UNITS));
});
