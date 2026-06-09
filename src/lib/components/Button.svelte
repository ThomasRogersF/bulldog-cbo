<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';

	const {
		variant = 'primary',
		size = 'md',
		type = 'button',
		loading = false,
		disabled = false,
		full = false,
		icon,
		iconRight,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		loading?: boolean;
		disabled?: boolean;
		full?: boolean;
		icon?: string;
		iconRight?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const isDisabled = $derived(disabled || loading);
	const iconSize = $derived(size === 'sm' ? 16 : 18);
</script>

<button
	{type}
	class="btn {full ? 'w-full' : ''}"
	class:variant-primary={variant === 'primary'}
	class:variant-secondary={variant === 'secondary'}
	class:variant-ghost={variant === 'ghost'}
	class:variant-danger={variant === 'danger'}
	class:size-sm={size === 'sm'}
	class:size-md={size === 'md'}
	class:size-lg={size === 'lg'}
	disabled={isDisabled}
	{onclick}
>
	{#if loading}
		<span class="spinner" aria-hidden="true"></span>
	{:else if icon}
		<Icon name={icon} size={iconSize} />
	{/if}
	{@render children()}
	{#if iconRight && !loading}
		<Icon name={iconRight} size={iconSize} />
	{/if}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid transparent;
		border-radius: var(--r-btn);
		font-family: var(--font-sans);
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		transition: all 150ms ease;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.38;
		cursor: not-allowed;
		box-shadow: none;
		transform: none;
	}

	/* Sizes */
	.size-sm {
		min-height: 40px;
		padding: 9px 13px;
		font-size: 13px;
		border-radius: 10px;
	}

	.size-md {
		min-height: 48px;
		padding: 11px 16px;
		font-size: 14px;
	}

	.size-lg {
		min-height: 56px;
		padding: 16px 20px;
		font-size: 16px;
		border-radius: 14px;
	}

	/* Variants */
	.variant-primary {
		background-color: var(--color-mustard);
		color: var(--color-accent-fg);
		box-shadow: 0 8px 18px -10px color-mix(in srgb, var(--color-mustard) 80%, transparent);
	}

	.variant-primary:hover:not(:disabled) {
		filter: brightness(1.06);
		transform: translateY(-1px);
	}

	.variant-secondary {
		background-color: var(--color-surface-2);
		color: var(--color-text);
		border-color: var(--color-line-2);
	}

	.variant-secondary:hover:not(:disabled) {
		background-color: var(--color-surface-3);
	}

	.variant-ghost {
		background-color: transparent;
		color: var(--color-text-dim);
	}

	.variant-ghost:hover:not(:disabled) {
		background-color: var(--color-surface-2);
		color: var(--color-text);
	}

	.variant-danger {
		background-color: color-mix(in srgb, var(--color-red) 13%, transparent);
		color: var(--color-red);
		border-color: color-mix(in srgb, var(--color-red) 30%, transparent);
	}

	.variant-danger:hover:not(:disabled) {
		background-color: var(--color-red);
		color: var(--color-danger-fg);
		border-color: var(--color-red);
	}

	/* Inline spinner */
	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: var(--radius-full);
		animation: btn-spin 0.6s linear infinite;
	}

	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
