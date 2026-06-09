// Active-shift state — loaded on mount and refreshed on open/close + realtime.
import { shiftsDb, notificationsDb } from '$lib/db';
import { authStore } from '$lib/stores/auth.svelte';
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
	const created = await shiftsDb.open(openingCash, notes);
	await loadActiveShift();
	// Fire-and-forget Telegram notification — never blocks the UI.
	notificationsDb
		.shiftOpened({
			shiftId: created.id,
			shiftNumber: created.shift_number,
			workerName: authStore.profile?.full_name ?? '',
			openedAt: created.opened_at
		})
		.catch(() => {});
}

export async function closeShift(id: string, closingCash: number, notes?: string): Promise<void> {
	await shiftsDb.close(id, { closingCashUsd: closingCash, notes });
	await loadActiveShift();
	// Fire-and-forget Telegram closing report — never blocks the UI.
	notificationsDb.shiftClosed(id).catch(() => {});
}

export function hasOpenShift(): boolean {
	return shiftStore.active !== null;
}
