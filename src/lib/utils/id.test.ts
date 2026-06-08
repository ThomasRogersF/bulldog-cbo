import { describe, it, expect } from 'vitest';
import { uuidv7 } from './id';

describe('uuidv7', () => {
	it('produces a valid v7 uuid', () => {
		expect(uuidv7()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});

	it('produces unique values', () => {
		expect(uuidv7()).not.toBe(uuidv7());
	});
});
