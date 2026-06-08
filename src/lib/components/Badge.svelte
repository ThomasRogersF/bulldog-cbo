<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		variant = 'neutral',
		children
	}: {
		variant?: 'success' | 'danger' | 'warning' | 'info' | 'secondary' | 'accent' | 'neutral';
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
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		padding: 2px 10px;
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
	}

	.v-success {
		background-color: var(--color-success);
		color: var(--color-success-fg);
	}

	.v-danger {
		background-color: var(--color-danger);
		color: var(--color-danger-fg);
	}

	.v-warning {
		background-color: var(--color-warning);
		color: var(--color-warning-fg);
	}

	.v-info {
		background-color: var(--color-info);
		color: var(--color-info-fg);
	}

	.v-secondary {
		background-color: var(--color-secondary);
		color: var(--color-secondary-fg);
	}

	.v-accent {
		background-color: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.v-neutral {
		background-color: var(--color-surface-overlay);
		color: var(--color-text-secondary);
	}
</style>
