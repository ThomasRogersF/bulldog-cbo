// Display formatters. Spanish (es-VE) locale; monetary values use grouping and
// are meant to render with `font-variant-numeric: tabular-nums`.
import { round2 } from '../domain/money';
import { t } from '../i18n';
import type { Unit } from '../types';

const usdFormatter = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const bsFormatter = new Intl.NumberFormat('es-VE', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export function formatUsd(n: number | null | undefined): string {
	return '$' + usdFormatter.format(round2(Number(n ?? 0)));
}

export function formatBs(n: number | null | undefined): string {
	return bsFormatter.format(round2(Number(n ?? 0))) + ' Bs';
}

export function formatQty(n: number | null | undefined, unit?: Unit | null): string {
	const value = Number(n ?? 0);
	const text = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, '');
	return unit && unit !== 'unit' ? `${text} ${t('units.' + unit)}` : text;
}

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Intl.DateTimeFormat('es-VE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	return new Intl.DateTimeFormat('es-VE', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	}).format(new Date(iso));
}

// Short relative time in Spanish — e.g. "hace 5 min", "hace 2 h".
export function timeAgo(iso: string | null | undefined): string {
	if (!iso) return '—';
	const diffMs = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return t('time.justNow');
	if (mins < 60) return `${t('time.ago')} ${mins} ${t('time.minutes')}`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${t('time.ago')} ${hours} ${t('time.hours')}`;
	const days = Math.floor(hours / 24);
	return `${t('time.ago')} ${days} ${t('time.days')}`;
}

// Elapsed duration between two instants (defaults the end to now) — "2h 30m".
export function formatDuration(fromIso: string | null | undefined, toIso?: string | null): string {
	if (!fromIso) return '—';
	const end = toIso ? new Date(toIso).getTime() : Date.now();
	const totalMins = Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 60000));
	const hours = Math.floor(totalMins / 60);
	const mins = totalMins % 60;
	return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
