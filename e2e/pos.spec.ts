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

	test('items added after resuming a parked order are preserved on confirm', async ({ page }) => {
		// 1. Add first item and park the order
		await page.locator('button.tile').first().click();
		let cart = await openCart(page);
		await expect(cart.locator('.cartline').first()).toBeVisible({ timeout: 10000 });
		await cart.getByRole('button', { name: /aparcar/i }).click();
		// Wait for the DB write to settle before re-opening the cart
		await page.waitForLoadState('networkidle');

		// 2. Re-open cart (mobile sheet closes after parking) and resume the parked order
		cart = await openCart(page);
		await cart.getByRole('button', { name: /agregar a orden existente/i }).click();
		const modal = page.locator('dialog[open]');
		await expect(modal).toBeVisible({ timeout: 8000 });
		await modal.locator('button.click-wrap').first().click();

		// 3. Cart now has item A from the parked order
		await expect(cart.locator('.cartline')).toHaveCount(1, { timeout: 10000 });

		// 4. Add a second, distinct item.
		// On mobile the cart sheet overlays the catalog — close it first by clicking the
		// exposed top of the backdrop (the panel is anchored to the bottom). No-op on desktop.
		const overlay = page.locator('.sheet-overlay');
		if (await overlay.isVisible()) {
			await overlay.click({ position: { x: 5, y: 5 } });
			await expect(overlay).toBeHidden({ timeout: 5000 });
		}
		await page.locator('button.tile').nth(1).click();
		cart = await openCart(page);
		await expect(cart.locator('.cartline')).toHaveCount(2, { timeout: 5000 });

		// 5. Confirm the order
		await cart.locator('button.pay').first().click();
		const confirmBtn = cart.getByRole('button', { name: /confirmar pedido/i });
		await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
		await confirmBtn.click();
		await expect(page.locator('.success-overlay')).toContainText(/pedido #\d+/i, {
			timeout: 15000
		});

		// 6. Check history — both items must appear in the confirmed order detail
		await page.goto('/orders');
		await page.getByRole('tab', { name: /historial/i }).click();
		await page.locator('button.row').first().click();
		// Detail modal — expect 2 line items (one per distinct menu item)
		const detailItems = page.locator('dialog li.item');
		await expect(detailItems).toHaveCount(2, { timeout: 10000 });
	});
});
