<script lang="ts">
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/inter/700.css';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { buildThemeCss } from '$lib/design/tokens-css';

	let { children } = $props();

	const themeCss = buildThemeCss();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- Design tokens as CSS variables — see src/lib/design/tokens.ts -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html `<style>${themeCss}</style>`}
</svelte:head>

{@render children()}
