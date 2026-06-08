// Active-shift state — loaded on mount and refreshed on open/close + realtime.
import { shiftsDb } from '$lib/db';
import type { ActiveShift } from '$lib/types';

export const shiftStore = $state({
	active: null as ActiveShift | null,
	loading: false
});

export async function loadActiveShift(): Promise<void> {
	shiftStore.loading = true;
	try {
		shiftStore.active = await shiftsDb.getActive();
	} finally {
		shiftStore.loading = false;
	}
}

export async function openShift(openingCash: number, notes?: string): Promise<void> {
	await shiftsDb.open(openingCash, notes);
	await loadActiveShift();
}

export async function closeShift(id: string, closingCash: number, notes?: string): Promise<void> {
	await shiftsDb.close(id, { closingCashUsd: closingCash, notes });
	await loadActiveShift();
}

export function hasOpenShift(): boolean {
	return shiftStore.active !== null;
}
