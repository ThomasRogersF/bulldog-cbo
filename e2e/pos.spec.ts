import { test, expect, ensureShiftOpen, openCart } from './fixtures';

test.describe('POS — Order flow', () => {
	test.beforeEach(async ({ page }) => {
		await ensureShiftOpen(page);
		await page.goto('/pos');
		// Menu tiles loaded
		await expect(page.locator('button.tile').first()).toBeVisible({ timeout: 15000 });
	});

	test('POS loads menu items', async ({ page }) => {
		// At least 3 items (bootstrap seeds 8)
		expect(await page.locator('button.tile').count()).toBeGreaterThan(2);
	});

	test('category filter works', async ({ page }) => {
		// "Todo" + one pill per category
		const pills = page.locator('button.pill');
		expect(await pills.count()).toBeGreaterThan(1);
		await pills.nth(1).click();
		// Still has items visible (every seeded category has items)
		await expect(page.locator('button.tile').first()).toBeVisible({ timeout: 10000 });
	});

	test('can add item to cart', async ({ page }) => {
		await page.locator('button.tile').first().click();
		const cart = await openCart(page);
		await expect(cart.locator('.cartline').first()).toBeVisible({ timeout: 10000 });
	});

	test('can complete a full order', async ({ page }) => {
		// Add an item
		await page.locator('button.tile').first().click();
		const cart = await openCart(page);
		await expect(cart.locator('.cartline').first()).toBeVisible({ timeout: 10000 });

		// Select payment method (grid renders once the cart has items)
		await cart.locator('button.pay').first().click();

		// Confirm order
		const confirmBtn = cart.getByRole('button', { name: /confirmar pedido/i });
		await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
		await confirmBtn.click();

		// Success overlay shows "Orden confirmada" + "Pedido #N" for ~2s
		await expect(page.locator('.success-overlay')).toContainText(/pedido #\d+/i, {
			timeout: 15000
		});
	});

	test('confirm button disabled with empty cart', async ({ page }) => {
		const cart = await openCart(page);
		// With an empty cart the confirm button reads "Agrega items al pedido"
		const confirmBtn = cart.getByRole('button', { name: /agrega items al pedido/i });
		await expect(confirmBtn).toBeDisabled({ timeout: 10000 });
	});
});
