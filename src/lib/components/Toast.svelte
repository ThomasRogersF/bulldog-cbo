<script lang="ts">
	import { toastStore, dismiss, type ToastKind } from '$lib/stores/toast.svelte';

	const ICONS: Record<ToastKind, string> = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ'
	};
</script>

<div class="stack" aria-live="polite" aria-atomic="false">
	{#each toastStore.items as toastItem (toastItem.id)}
		<button
			type="button"
			class="toast {toastItem.kind}"
			aria-label={toastItem.message}
			onclick={() => dismiss(toastItem.id)}
		>
			<span class="bar" aria-hidden="true"></span>
			<span class="icon" aria-hidden="true">{ICONS[toastItem.kind]}</span>
			<span class="message">{toastItem.message}</span>
		</button>
	{/each}
</div>

<style>
	.stack {
		position: fixed;
		z-index: 1000;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: calc(100% - 2rem);
		max-width: 24rem;
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.stack {
			bottom: auto;
			top: 1rem;
			left: auto;
			right: 1rem;
			transform: none;
		}
	}

	.toast {
		pointer-events: auto;
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		min-height: 48px;
		padding: 0.75rem 1rem 0.75rem 1.25rem;
		overflow: hidden;
		text-align: left;
		background: var(--color-surface-raised);
		color: var(--color-text-primary);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow:
			0 4px 6px rgba(0, 0, 0, 0.1),
			0 2px 4px rgba(0, 0, 0, 0.06);
		font-family: var(--font-sans);
		cursor: pointer;
		transition:
			transform 150ms ease,
			box-shadow 150ms ease;
		animation: slide-in 150ms ease;
	}

	.toast:active {
		transform: scale(0.98);
	}

	.bar {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 5px;
		border-top-left-radius: var(--radius-lg);
		border-bottom-left-radius: var(--radius-lg);
	}

	.icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius-full);
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1;
	}

	.message {
		flex: 1;
		min-width: 0;
		font-size: 0.9375rem;
		line-height: 1.3;
	}

	.success .bar,
	.success .icon {
		background: var(--color-success);
	}
	.success .icon {
		color: var(--color-success-fg);
	}

	.error .bar,
	.error .icon {
		background: var(--color-danger);
	}
	.error .icon {
		color: var(--color-danger-fg);
	}

	.warning .bar,
	.warning .icon {
		background: var(--color-warning);
	}
	.warning .icon {
		color: var(--color-warning-fg);
	}

	.info .bar,
	.info .icon {
		background: var(--color-info);
	}
	.info .icon {
		color: var(--color-info-fg);
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
