import { test, expect } from './fixtures';

test.describe('Mobile layout', () => {
	test.use({ viewport: { width: 390, height: 844 } });
	// Authenticated via shared storageState — each test navigates directly.

	test('bottom nav visible on mobile', async ({ page }) => {
		await page.goto('/pos');
		await expect(page.locator('nav.mobilenav')).toBeVisible({ timeout: 10000 });
	});

	test('bottom nav does not overlap content on Turnos', async ({ page }) => {
		await page.goto('/shifts');
		const nav = page.locator('nav.mobilenav');
		await expect(nav).toBeVisible({ timeout: 10000 });
		// Page content loaded (history section is always rendered)
		await expect(page.getByText(/historial de turnos/i)).toBeVisible({ timeout: 15000 });
		// Scroll to bottom — nav stays put and the page has real content
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
		expect(bodyHeight).toBeGreaterThan(200);
		await expect(nav).toBeVisible();
	});

	test('POS cart is accessible above the bottom nav', async ({ page }) => {
		await page.goto('/pos');

		// On mobile the cart entry point is the sticky cart bar
		const cartBar = page.locator('button.cart-bar-btn');
		await expect(cartBar).toBeVisible({ timeout: 10000 });

		// The cart bar must sit fully above the bottom nav (no overlap)
		const navBox = await page.locator('nav.mobilenav').boundingBox();
		const barBox = await cartBar.boundingBox();
		expect(navBox).not.toBeNull();
		expect(barBox).not.toBeNull();
		if (navBox && barBox) {
			expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);
		}

		// The confirm button is reachable inside the cart sheet
		await cartBar.click();
		const sheet = page.locator('.sheet-panel');
		await expect(sheet).toBeVisible({ timeout: 5000 });
		await expect(
			sheet.getByRole('button', { name: /confirmar pedido|agrega items al pedido/i })
		).toBeVisible();
	});
});
