<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	const {
		icon,
		title,
		subtitle,
		action
	}: {
		icon?: string;
		title: string;
		subtitle?: string;
		action?: Snippet;
	} = $props();
</script>

<div class="empty-state flex flex-col items-center justify-center text-center gap-2 p-8">
	{#if icon}
		<span class="icon" aria-hidden="true"><Icon name={icon} size={30} /></span>
	{/if}
	<p class="title">{title}</p>
	{#if subtitle}
		<p class="subtitle">{subtitle}</p>
	{/if}
	{#if action}
		<div class="action mt-4">
			{@render action?.()}
		</div>
	{/if}
</div>

<style>
	.empty-state {
		font-family: var(--font-sans);
	}

	.icon {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
		border-radius: 18px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line);
		color: var(--color-mustard);
		margin-bottom: 4px;
	}

	.title {
		color: var(--color-text);
		font-weight: 800;
		font-size: 1.125rem;
	}

	.subtitle {
		color: var(--color-text-faint);
		font-size: 0.9375rem;
		max-width: 28rem;
	}
</style>
