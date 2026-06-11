import { test, expect } from './fixtures';

test.describe('Navigation', () => {
	// Authenticated via shared storageState — each test navigates directly.

	// TopBar renders the route title as the page <h1>
	const routes = [
		{ path: '/pos', title: /^punto de venta$/i },
		{ path: '/orders', title: /^pedidos$/i },
		{ path: '/dashboard', title: /^panel$/i },
		{ path: '/menu', title: /^menú$/i },
		{ path: '/ingredients', title: /^ingredientes$/i },
		{ path: '/customers', title: /^clientes$/i },
		{ path: '/shifts', title: /^turnos$/i },
		{ path: '/settings', title: /^configuración$/i }
	];

	for (const route of routes) {
		test(`${route.path} loads without error`, async ({ page }) => {
			await page.goto(route.path);
			// The TopBar renders the route's own title only when the page mounts
			// successfully — a SvelteKit error page would not. That's the load check;
			// a body-text scan for "500" collides with real data (e.g. "Stock mínimo: 500").
			await expect(page.locator('h1.topbar__title')).toHaveText(route.title, {
				timeout: 10000
			});
		});
	}

	test('desktop sidebar is visible at 1280px', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/pos');
		await expect(page.locator('aside.sidebar')).toBeVisible();
	});

	test('bottom nav is visible on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/pos');
		await expect(page.locator('nav.mobilenav')).toBeVisible();
	});

	test('sidebar hidden on mobile', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/pos');
		await expect(page.locator('aside.sidebar')).toBeHidden();
	});
});
