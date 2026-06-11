import { test as setup } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';
import { login, OWNER } from './fixtures';
import { STORAGE_STATE } from '../playwright.config';

// Runs once before the test projects. Logs in as the owner through the real UI
// and persists the Supabase session (stored in localStorage) so every test can
// reuse it instead of signing in again — which would hit Supabase's auth rate
// limit and slow the suite to a crawl.
setup('authenticate as owner', async ({ page }) => {
	await login(page, OWNER.email, OWNER.password);
	await mkdir(path.dirname(STORAGE_STATE), { recursive: true });
	await page.context().storageState({ path: STORAGE_STATE });
});
