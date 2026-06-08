import { es } from './messages/es';

// Look up a dot-pathed key (e.g. 'pos.confirm') in the es-VE catalog.
// Falls back to the key itself when a translation is missing.
export function t(key: string): string {
	const value = key.split('.').reduce<unknown>((acc, part) => {
		if (acc && typeof acc === 'object' && part in acc) {
			return (acc as Record<string, unknown>)[part];
		}
		return undefined;
	}, es as unknown);

	return typeof value === 'string' ? value : key;
}
