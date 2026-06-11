import { test, expect } from './fixtures';

test.describe('Dashboard', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dashboard');
	});

	test('KPI cards are visible', async ({ page }) => {
		// 4 KPI cards render unconditionally
		const kpis = page.locator('div.kpi');
		await expect(kpis.first()).toBeVisible({ timeout: 15000 });
		expect(await kpis.count()).toBeGreaterThanOrEqual(4);
	});

	test('sales chart is visible', async ({ page }) => {
		// Heading renders even when there are no sales yet
		await expect(page.getByText(/ventas por hora/i).first()).toBeVisible({ timeout: 15000 });
	});

	test('top products section visible', async ({ page }) => {
		// "Top 5 productos" appears as heading (and again as a badge)
		await expect(page.getByText(/top 5 productos/i).first()).toBeVisible({ timeout: 15000 });
	});
});
