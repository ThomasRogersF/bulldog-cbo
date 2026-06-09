<script lang="ts">
	import { toastStore, dismiss, type ToastKind } from '$lib/stores/toast.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const ICONS: Record<ToastKind, string> = {
		success: 'check',
		error: 'x',
		warning: 'alert',
		info: 'bell'
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
			<span class="icon" aria-hidden="true"
				><Icon name={ICONS[toastItem.kind]} size={16} stroke={3} /></span
			>
			<span class="message">{toastItem.message}</span>
		</button>
	{/each}
</div>

<style>
	.stack {
		position: fixed;
		z-index: 1000;
		bottom: 28px;
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
		gap: 10px;
		width: 100%;
		min-height: 48px;
		padding: 14px 22px;
		overflow: hidden;
		text-align: left;
		border: none;
		border-radius: 13px;
		font-family: var(--font-sans);
		font-weight: 800;
		font-size: 14px;
		box-shadow: 0 18px 44px -14px rgba(0, 0, 0, 0.7);
		cursor: pointer;
		transition:
			transform 150ms ease,
			box-shadow 150ms ease;
		animation: slide-in 200ms ease;
	}

	.toast:active {
		transform: scale(0.98);
	}

	.icon {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.16);
		line-height: 1;
	}

	.message {
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}

	.success {
		background: var(--color-green);
		color: var(--color-success-fg);
	}

	.error {
		background: var(--color-red);
		color: var(--color-danger-fg);
	}

	.warning {
		background: var(--color-amber);
		color: var(--color-warning-fg);
	}

	.info {
		background: var(--color-surface-2);
		color: var(--color-text);
		border: 1px solid var(--color-line);
	}
	.info .icon {
		background: var(--color-mustard-soft);
		color: var(--color-mustard);
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
