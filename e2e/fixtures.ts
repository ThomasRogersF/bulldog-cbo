import { test as base, expect, type Locator, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// Credentials come from e2e/.env.test (gitignored) — never hardcoded.
// npm scripts always run from the package root, so resolve from cwd.
dotenv.config({ path: path.resolve(process.cwd(), 'e2e', '.env.test'), quiet: true });

export const OWNER = {
	email: process.env.E2E_OWNER_EMAIL ?? '',
	password: process.env.E2E_OWNER_PASSWORD ?? ''
};

export const WORKER = {
	email: process.env.E2E_WORKER_EMAIL ?? '',
	password: process.env.E2E_WORKER_PASSWORD ?? ''
};

const OPEN_SHIFT = /abrir turno/i;
const CLOSE_SHIFT = /cerrar turno/i;

// Helper: log in and wait for the app shell
export async function login(page: Page, email: string, password: string) {
	if (!email || !password) {
		throw new Error(
			'Missing E2E credentials — set E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD in e2e/.env.test'
		);
	}
	await page.goto('/login');
	await page.waitForSelector('input[type="email"]', { timeout: 10000 });
	await page.fill('input[type="email"]', email);
	await page.fill('input[type="password"]', password);
	await page.click('button[type="submit"]');
	// Wait for redirect away from login
	await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
	// The TopBar renders once auth + profile are ready, on every viewport.
	await page.locator('header.topbar').waitFor({ state: 'visible', timeout: 15000 });
}

// Helper: close any open shift (cleanup). Leaves the page on /shifts
// with the open-shift form showing.
export async function closeAnyOpenShift(page: Page) {
	await page.goto('/shifts');
	const openBtn = page.getByRole('button', { name: OPEN_SHIFT });
	const closeBtn = page.getByRole('button', { name: CLOSE_SHIFT });
	// The page shows exactly one of the two once the shift store has loaded.
	await expect(openBtn.or(closeBtn).first()).toBeVisible({ timeout: 15000 });
	if (await closeBtn.isVisible()) {
		await closeBtn.click();
		const modal = page.locator('dialog.modal');
		await expect(modal).toBeVisible({ timeout: 5000 });
		await modal.getByLabel(/efectivo contado/i).fill('10');
		await modal.getByRole('button', { name: CLOSE_SHIFT }).click();
		await expect(openBtn).toBeVisible({ timeout: 15000 });
	}
}

// Helper: make sure a shift is open. Leaves the page on /shifts.
export async function ensureShiftOpen(page: Page) {
	await page.goto('/shifts');
	const openBtn = page.getByRole('button', { name: OPEN_SHIFT });
	const closeBtn = page.getByRole('button', { name: CLOSE_SHIFT });
	await expect(openBtn.or(closeBtn).first()).toBeVisible({ timeout: 15000 });
	if (await openBtn.isVisible()) {
		await page.getByLabel(/efectivo inicial/i).fill('10');
		await openBtn.click();
		await expect(closeBtn).toBeVisible({ timeout: 15000 });
	}
}

// Helper: return the visible cart container on /pos.
// Desktop (>=768px) renders the cart in <aside class="pos__cart">; mobile keeps
// it in a BottomSheet behind the sticky cart bar. The sheet only mounts its
// children while open, so the locator must be scoped to whichever copy is live.
export async function openCart(page: Page): Promise<Locator> {
	const sheet = page.locator('.sheet-panel');
	if (await sheet.isVisible()) return sheet;
	const cartBar = page.locator('button.cart-bar-btn');
	if (await cartBar.isVisible()) {
		await cartBar.click();
		await expect(sheet).toBeVisible({ timeout: 5000 });
		return sheet;
	}
	return page.locator('aside.pos__cart');
}

export const test = base;
export { expect };
