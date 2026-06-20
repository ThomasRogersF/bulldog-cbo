export type DateRangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

export interface DateRange {
	preset: DateRangePreset;
	from: Date | null;
	to: Date | null;
}

function startOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

function endOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(23, 59, 59, 999);
	return x;
}

export function rangeFromPreset(preset: DateRangePreset): DateRange {
	const now = new Date();

	switch (preset) {
		case 'today':
			return { preset, from: startOfDay(now), to: endOfDay(now) };

		case 'yesterday': {
			const y = new Date(now);
			y.setDate(y.getDate() - 1);
			return { preset, from: startOfDay(y), to: endOfDay(y) };
		}

		case 'week': {
			const start = new Date(now);
			const day = start.getDay();
			const diff = day === 0 ? 6 : day - 1;
			start.setDate(start.getDate() - diff);
			return { preset, from: startOfDay(start), to: endOfDay(now) };
		}

		case 'month': {
			const start = new Date(now.getFullYear(), now.getMonth(), 1);
			return { preset, from: startOfDay(start), to: endOfDay(now) };
		}

		case 'all':
		default:
			return { preset: 'all', from: null, to: null };
	}
}

export function isInRange(dateValue: string | Date, range: DateRange): boolean {
	if (range.preset === 'all' || !range.from || !range.to) return true;
	const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
	return d >= range.from && d <= range.to;
}

export function rangeLabel(range: DateRange): string {
	if (range.preset === 'all') return 'Todo el historial';
	if (range.preset === 'today') return 'Hoy';
	if (range.preset === 'yesterday') return 'Ayer';
	if (range.preset === 'week') return 'Esta semana';
	if (range.preset === 'month') return 'Este mes';
	if (range.from && range.to) {
		const f = range.from.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
		const t = range.to.toLocaleDateString('es-VE', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
		return `${f} – ${t}`;
	}
	return '';
}
