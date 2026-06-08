<script lang="ts">
	import type { Snippet } from 'svelte';

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
		<span class="icon" aria-hidden="true">{icon}</span>
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
		font-size: 48px;
		line-height: 1;
	}

	.title {
		color: var(--color-text-primary);
		font-weight: 600;
		font-size: 1.125rem;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: 0.9375rem;
		max-width: 28rem;
	}
</style>
