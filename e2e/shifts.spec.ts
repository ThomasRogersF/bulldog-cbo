import { test, expect, closeAnyOpenShift, ensureShiftOpen } from './fixtures';

test.describe('Shifts', () => {
	test.beforeEach(async ({ page }) => {
		await closeAnyOpenShift(page);
	});

	test('can open a shift', async ({ page }) => {
		// closeAnyOpenShift leaves us on /shifts with the open form showing
		await page.getByLabel(/efectivo inicial/i).fill('10');
		await page.getByRole('button', { name: /abrir turno/i }).click();

		// The active-shift view replaces the open form. Its "Cerrar turno" button is
		// the authoritative signal that the active branch rendered — wait generously,
		// since realtime refetch churn can briefly re-show the loading spinner.
		await expect(page.getByRole('button', { name: /cerrar turno/i })).toBeVisible({
			timeout: 15000
		});
		// The active shift card shows its number. Scope to the card's own element:
		// getByText(/turno #/) also matches the sidebar + topbar badges, and the
		// sidebar one is display:none on mobile, so .first() resolves to a hidden node.
		await expect(page.locator('span.shift-number')).toBeVisible();
		await expect(page.locator('span.shift-number')).toHaveText(/turno #\d+/i);
	});

	test('open shift shows in topbar badge', async ({ page }) => {
		await ensureShiftOpen(page);

		// Navigate to POS and check the topbar badge
		await page.goto('/pos');
		const badge = page.locator('[class*="badge"]').filter({ hasText: /turno #/i });
		await expect(badge.first()).toBeVisible({ timeout: 10000 });
	});

	test('can close an open shift', async ({ page }) => {
		await ensureShiftOpen(page);

		// Close the shift
		await page.getByRole('button', { name: /cerrar turno/i }).click();

		// Fill closing cash in the modal
		const modal = page.locator('dialog.modal');
		await expect(modal).toBeVisible({ timeout: 5000 });
		await modal.getByLabel(/efectivo contado/i).fill('10');

		// Confirm close (the modal's own "Cerrar turno" button)
		await modal.getByRole('button', { name: /cerrar turno/i }).click();

		// Back to the open-shift form + history
		await expect(page.getByRole('button', { name: /abrir turno/i })).toBeVisible({
			timeout: 15000
		});
		await expect(page.getByText(/historial de turnos/i)).toBeVisible();
	});
});
