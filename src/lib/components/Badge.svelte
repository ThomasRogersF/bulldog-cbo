<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	const {
		variant = 'neutral',
		icon,
		children
	}: {
		variant?: 'success' | 'danger' | 'warning' | 'info' | 'secondary' | 'accent' | 'neutral';
		icon?: string;
		children: Snippet;
	} = $props();
</script>

<span
	class="badge"
	class:v-success={variant === 'success'}
	class:v-danger={variant === 'danger'}
	class:v-warning={variant === 'warning'}
	class:v-info={variant === 'info'}
	class:v-secondary={variant === 'secondary'}
	class:v-accent={variant === 'accent'}
	class:v-neutral={variant === 'neutral'}
>
	{#if icon}<Icon name={icon} size={12} stroke={2.4} />{/if}
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border-radius: var(--radius-full);
		padding: 4px 9px;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
	}

	/* Hero — solid mustard */
	.v-accent {
		background-color: var(--color-mustard);
		color: var(--color-accent-fg);
	}

	/* Soft mustard tint */
	.v-secondary {
		background-color: var(--color-mustard-soft);
		color: var(--color-mustard);
	}

	.v-success {
		background-color: color-mix(in srgb, var(--color-green) 16%, transparent);
		color: var(--color-green);
	}

	.v-danger {
		background-color: color-mix(in srgb, var(--color-red) 16%, transparent);
		color: var(--color-red);
	}

	.v-warning {
		background-color: color-mix(in srgb, var(--color-amber) 16%, transparent);
		color: var(--color-amber);
	}

	.v-info {
		background-color: color-mix(in srgb, var(--color-info) 16%, transparent);
		color: var(--color-info);
	}

	.v-neutral {
		background-color: var(--color-surface-2);
		color: var(--color-text-dim);
	}
</style>
