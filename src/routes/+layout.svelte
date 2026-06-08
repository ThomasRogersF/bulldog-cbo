<script lang="ts">
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/inter/700.css';
	import '../app.css';
	import { buildThemeCss } from '$lib/design/tokens-css';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authStore, initAuth, isOwner } from '$lib/stores/auth.svelte';
	import { loadActiveShift } from '$lib/stores/shift.svelte';
	import { connectRealtime } from '$lib/stores/realtime.svelte';

	import Toast from '$lib/components/Toast.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import NavBar from '$lib/components/NavBar.svelte';
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
		<TopBar />
		<main class="app-main pt-14 pb-20 lg:pt-0 lg:pb-0 lg:pl-[240px]">
			{@render children()}
		</main>
	</div>
	<Toast />
{/if}

<style>
	.app-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--color-surface-base);
	}

	.app-shell {
		min-height: 100vh;
		background: var(--color-surface-base);
	}

	.app-main {
		min-height: 100vh;
		color: var(--color-text-primary);
		font-family: var(--font-sans);
	}
</style>
