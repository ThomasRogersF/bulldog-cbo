import { test, expect, login, OWNER } from './fixtures';

// These tests exercise login / redirect guards, so they must start logged OUT —
// override the shared owner storageState with an empty one.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
	test('login page loads with dark theme', async ({ page }) => {
		await page.goto('/login');
		await expect(page).toHaveTitle(/bulldog cbo/i);
		// Dark theme — html element has data-theme="dark" (fresh context, no stored theme)
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		// Login form visible
		await expect(page.getByRole('heading', { name: /bulldog cbo/i })).toBeVisible();
		await expect(page.getByLabel(/usuario/i)).toBeVisible();
		await expect(page.getByLabel(/contraseña/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
	});

	test('wrong credentials shows error', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel(/usuario/i).fill('wronguser');
		await page.fill('input[type="password"]', 'wrongpassword');
		await page.click('button[type="submit"]');
		// The error banner (role="alert") appears with the i18n message once the
		// auth request settles. The suite's first auth call can hit a cold Supabase
		// endpoint, so allow generous headroom before declaring it broken.
		await expect(
			page.getByRole('alert').filter({ hasText: /usuario o contraseña incorrectos/i })
		).toBeVisible({ timeout: 20000 });
		// Still on login page
		await expect(page).toHaveURL(/\/login/);
	});

	test('owner can log in and reaches app', async ({ page }) => {
		await login(page, OWNER.username, OWNER.password);
		await expect(page).not.toHaveURL(/\/login/);
		// Exactly one of the two navs (sidebar / bottom nav) is visible per viewport
		await expect(page.locator('nav[aria-label="Principal"]:visible')).toBeVisible();
	});

	test('unauthenticated user redirected to login', async ({ page }) => {
		await page.goto('/pos');
		await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
	});
});
