// Pure money math — no Supabase, no Svelte. Shared by db.ts, the cart store, and
// the formatters, and unit-tested in isolation.

export function round2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotal(unitPriceUsd: number, qty: number): number {
	return round2(unitPriceUsd * qty);
}

export interface OrderTotals {
	subtotalUsd: number;
	totalUsd: number;
	totalBs: number;
}

// Subtotal from line totals, minus discount (clamped at 0), then Bs at the rate.
export function computeTotals(
	lineTotals: number[],
	discountUsd: number,
	usdRate: number
): OrderTotals {
	const subtotalUsd = round2(lineTotals.reduce((sum, n) => sum + n, 0));
	const totalUsd = round2(Math.max(0, subtotalUsd - discountUsd));
	const totalBs = round2(totalUsd * usdRate);
	return { subtotalUsd, totalUsd, totalBs };
}

// Drawer reconciliation: only physical USD cash affects the expected count.
export function expectedCash(openingCashUsd: number, cashUsdSales: number): number {
	return round2(openingCashUsd + cashUsdSales);
}

export function variance(closingCashUsd: number, expectedCashUsd: number): number {
	return round2(closingCashUsd - expectedCashUsd);
}
