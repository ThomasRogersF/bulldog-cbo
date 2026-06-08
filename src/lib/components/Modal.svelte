<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n';

	let {
		open = $bindable(false),
		title,
		onclose,
		children
	}: {
		open?: boolean;
		title?: string;
		onclose?: () => void;
		children: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function handleClose() {
		open = false;
		onclose?.();
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={handleClose}>
	<div class="modal-header">
		{#if title}
			<h2 class="modal-title">{title}</h2>
		{:else}
			<span></span>
		{/if}
		<button type="button" class="modal-close" aria-label={t('common.close')} onclick={handleClose}>
			&times;
		</button>
	</div>
	<div class="modal-body">
		{@render children()}
	</div>
</dialog>

<style>
	.modal {
		padding: 0;
		border: none;
		width: 92vw;
		max-width: 480px;
		background: var(--color-surface-raised);
		color: var(--color-text-primary);
		border-radius: var(--radius-lg);
		font-family: var(--font-sans);
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.12),
			0 4px 8px rgba(0, 0, 0, 0.08);
		margin: auto auto 16px auto;
		transform: translateY(16px) scale(0.98);
		opacity: 0;
		transition:
			transform 150ms ease,
			opacity 150ms ease;
	}

	.modal[open] {
		transform: translateY(0) scale(1);
		opacity: 1;
	}

	.modal::backdrop {
		background: var(--color-overlay);
		backdrop-filter: blur(2px);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 16px 0 20px;
	}

	.modal-title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 48px;
		min-height: 48px;
		margin: -8px -8px 0 0;
		font-size: 1.75rem;
		line-height: 1;
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease,
			transform 150ms ease;
	}

	.modal-close:hover {
		background: var(--color-surface-overlay);
		color: var(--color-text-primary);
	}

	.modal-close:active {
		transform: scale(0.92);
	}

	.modal-body {
		padding: 20px;
	}

	@media (min-width: 768px) {
		.modal {
			margin: auto;
		}
	}
</style>
