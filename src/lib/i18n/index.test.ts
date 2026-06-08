import { describe, it, expect } from 'vitest';
import { t } from './index';

describe('t()', () => {
	it('resolves a nested key via dot notation', () => {
		expect(t('pos.confirm')).toBe('Confirmar');
		expect(t('orderType.dine_in')).toBe('Para aquí');
		expect(t('payment.pagomovil')).toBe('Pago móvil');
	});

	it('falls back to the key when the path is missing', () => {
		expect(t('does.not.exist')).toBe('does.not.exist');
	});

	it('falls back to the key when the path resolves to a non-string', () => {
		expect(t('pos')).toBe('pos');
	});
});
