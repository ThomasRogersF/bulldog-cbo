// Supabase Realtime → a version-counter bus. Screens do
//   $effect(() => { track(dataVersion.orders); reload(); })
// to refetch when the relevant table changes. One channel, guarded against dupes.
import { supabase } from '$lib/db';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { loadActiveShift } from './shift.svelte';

export const dataVersion = $state({ orders: 0, ledger: 0, shifts: 0 });

// Read reactive dependencies inside an $effect as a plain function call (the
// argument reads register the dependency) without a bare unused-expression.
export function track(...deps: unknown[]): number {
	return deps.length;
}

let channel: RealtimeChannel | null = null;

export function connectRealtime(): void {
	if (channel) return;
	channel = supabase
		.channel('bulldog-cbo')
		.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
			dataVersion.orders++;
			void loadActiveShift();
		})
		.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
			dataVersion.orders++;
		})
		.on('postgres_changes', { event: '*', schema: 'public', table: 'ingredient_ledger' }, () => {
			dataVersion.ledger++;
		})
		.on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
			dataVersion.shifts++;
			void loadActiveShift();
		})
		.subscribe();
}

export function disconnectRealtime(): void {
	if (channel) {
		void supabase.removeChannel(channel);
		channel = null;
	}
}
