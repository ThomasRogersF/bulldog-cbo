<script lang="ts">
	import '@fontsource/archivo/400.css';
	import '@fontsource/archivo/500.css';
	import '@fontsource/archivo/600.css';
	import '@fontsource/archivo/700.css';
	import '@fontsource/archivo/800.css';
	import '@fontsource/archivo/900.css';
	import '../app.css';
	import { buildThemeCss } from '$lib/design/tokens-css';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authStore, initAuth, isOwner } from '$lib/stores/auth.svelte';
	import { loadActiveShift } from '$lib/stores/shift.svelte';
	import { connectRealtime } from '$lib/stores/realtime.svelte';
	import { initInstall } from '$lib/stores/install.svelte';

	import Toast from '$lib/components/Toast.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let { children } = $props();

	const themeCss = buildThemeCss();

	const OWNER_ONLY = ['/dashboard', '/menu', '/ingredients', '/settings'];

	// Bootstrap auth exactly once.
	let started = false;
	$effect(() => {
		if (started) return;
		started = true;
		void initAuth();
		// Capture beforeinstallprompt as early as possible, even on /login, so the
		// banner can offer install once the user is authenticated.
		initInstall();
		// Register the service worker (autoUpdate). No-op in dev where the PWA is
		// disabled; in production this caches the app shell for offline launch.
		void import('virtual:pwa-register').then(({ registerSW }) => {
			registerSW({ immediate: true });
		});
	});

	// Once authenticated, load the active shift + open the realtime channel once.
	let sessionStarted = false;
	$effect(() => {
		if (authStore.ready && authStore.user && !sessionStarted) {
			sessionStarted = true;
			void loadActiveShift();
			connectRealtime();
		}
	});

	// Auth + role redirects (only after auth has resolved).
	$effect(() => {
		if (!authStore.ready) return;
		const path = page.url.pathname;
		if (!authStore.user && path !== '/login') {
			void goto(resolve('/login'));
		} else if (authStore.user && path === '/login') {
			void goto(resolve('/pos'));
		} else if (
			authStore.user &&
			OWNER_ONLY.some((p) => path === p || path.startsWith(p + '/')) &&
			!isOwner()
		) {
			void goto(resolve('/pos'));
		}
	});

	const showChrome = $derived(
		authStore.ready && !!authStore.user && page.url.pathname !== '/login'
	);
</script>

<svelte:head>
	<!-- Design tokens as CSS variables — see src/lib/design/tokens.ts -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<style>${themeCss}</style>`}
</svelte:head>

{#if !authStore.ready}
	<div class="app-loading">
		<LoadingSpinner size="lg" />
	</div>
{:else if !showChrome}
	{@render children()}
	<Toast />
{:else}
	<div class="app-shell">
		<NavBar />
		<div class="main">
			<TopBar />
			<div class="content pb-20 lg:pb-0">
				{@render children()}
			</div>
		</div>
	</div>
	<InstallPrompt />
	<Toast />
{/if}

<style>
	.app-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--color-bg);
	}

	.app-shell {
		background: var(--color-bg);
	}

	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		height: 100vh;
	}

	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		color: var(--color-text);
		font-family: var(--font-sans);
	}

	@media (min-width: 1024px) {
		.main {
			margin-left: 250px;
		}
	}
</style>
