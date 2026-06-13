import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Bulldog CBO',
				short_name: 'Bulldog CBO',
				description: 'Sistema POS — Bulldog CBO',
				lang: 'es',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#100F0D',
				theme_color: '#100F0D',
				orientation: 'any',
				icons: [
					{ src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png' },
					{ src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
					{ src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png' },
					{ src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png' },
					{ src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png' },
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
					{
						src: '/icons/icon-maskable-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: '/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				// Cache the app shell for offline launch.
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
				// Never cache Supabase API calls — always go to network for live data.
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
						handler: 'NetworkOnly'
					}
				],
				navigateFallback: '/'
			},
			devOptions: {
				enabled: false // avoid SW caching issues during dev
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
