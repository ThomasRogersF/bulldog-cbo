import { defineConfig, devices } from '@playwright/test';

// Reused auth session — written once by e2e/auth.setup.ts, consumed by every
// project. Logging in per test would exhaust Supabase's auth rate limit.
export const STORAGE_STATE = 'e2e/.auth/owner.json';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false, // sequential — Supabase has shared state
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1, // one worker — shared DB
	reporter: [['html', { open: 'never' }], ['list']],

	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'off',
		locale: 'es-VE'
	},

	projects: [
		// Logs in once and saves the Supabase session to STORAGE_STATE.
		{ name: 'setup', testMatch: /auth\.setup\.ts/ },
		{
			name: 'Desktop Chrome',
			use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
			dependencies: ['setup']
		},
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'], storageState: STORAGE_STATE },
			dependencies: ['setup']
		}
	],

	// Start dev server before tests
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 30000
	}
});
