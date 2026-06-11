import { test, expect } from './fixtures';

test.describe('Ingredients', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/ingredients');
		// Stock tab is the default; wait for ingredient cards
		await expect(page.locator('div.ing').first()).toBeVisible({ timeout: 15000 });
	});

	test('stock tab shows ingredient cards', async ({ page }) => {
		expect(await page.locator('div.ing').count()).toBeGreaterThan(0);
	});

	test('category filter works', async ({ page }) => {
		// "Todos" + one pill per ingredient category
		const pills = page.locator('button.pill');
		expect(await pills.count()).toBeGreaterThan(1);
		await pills.nth(1).click();
		// Cards for that category (or the empty state) render without crashing
		await expect(
			page
				.locator('div.ing')
				.first()
				.or(page.getByText(/no hay ingredientes/i))
				.first()
		).toBeVisible({ timeout: 10000 });
	});

	test('movimientos tab loads', async ({ page }) => {
		await page.getByRole('tab', { name: /movimientos/i }).click();
		// Movement rows (seed data creates opening counts) or the empty state
		await expect(
			page
				.locator('div.move')
				.first()
				.or(page.getByText(/sin movimientos/i))
				.first()
		).toBeVisible({ timeout: 15000 });
	});

	test('restock modal opens', async ({ page }) => {
		await page
			.getByRole('button', { name: /reponer/i })
			.first()
			.click();

		// Native <dialog class="modal"> opened via showModal()
		const modal = page.locator('dialog.modal[open]');
		await expect(modal).toBeVisible({ timeout: 5000 });
		await expect(modal.getByRole('button', { name: /registrar reposición/i })).toBeVisible();
	});
});
