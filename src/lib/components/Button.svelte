<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		variant = 'primary',
		size = 'md',
		type = 'button',
		loading = false,
		disabled = false,
		full = false,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		loading?: boolean;
		disabled?: boolean;
		full?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const isDisabled = $derived(disabled || loading);
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
	{/if}
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: none;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-weight: 600;
		cursor: pointer;
		transition: all 150ms ease;
		white-space: nowrap;
	}

	.btn:active:not(:disabled) {
		transform: scale(0.97);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Sizes */
	.size-sm {
		min-height: 40px;
		padding: 0 12px;
		font-size: 0.875rem;
	}

	.size-md {
		min-height: 48px;
		padding: 0 16px;
		font-size: 1rem;
	}

	.size-lg {
		min-height: 56px;
		padding: 0 20px;
		font-size: 1.125rem;
	}

	/* Variants */
	.variant-primary {
		background-color: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.variant-primary:hover:not(:disabled) {
		background-color: var(--color-accent-hover);
	}

	.variant-secondary {
		background-color: transparent;
		color: var(--color-accent);
		border: 1px solid var(--color-accent);
	}

	.variant-secondary:hover:not(:disabled) {
		background-color: var(--color-surface-overlay);
	}

	.variant-ghost {
		background-color: transparent;
		color: var(--color-text-primary);
	}

	.variant-ghost:hover:not(:disabled) {
		background-color: var(--color-surface-overlay);
	}

	.variant-danger {
		background-color: var(--color-danger);
		color: var(--color-danger-fg);
	}

	.variant-danger:hover:not(:disabled) {
		filter: brightness(0.95);
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
