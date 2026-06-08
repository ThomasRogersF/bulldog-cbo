// Toast notifications — the <Toast /> component renders toastStore.items.
import { uuidv7 } from '$lib/utils/id';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
	id: string;
	kind: ToastKind;
	message: string;
}

export const toastStore = $state({ items: [] as ToastItem[] });

function push(kind: ToastKind, message: string): void {
	const id = uuidv7();
	toastStore.items = [...toastStore.items, { id, kind, message }];
	setTimeout(() => dismiss(id), 3000);
}

export function dismiss(id: string): void {
	toastStore.items = toastStore.items.filter((t) => t.id !== id);
}

export const toast = {
	success: (m: string) => push('success', m),
	error: (m: string) => push('error', m),
	warning: (m: string) => push('warning', m),
	info: (m: string) => push('info', m)
};
