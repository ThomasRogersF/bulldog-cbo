<script lang="ts">
	import { t } from '$lib/i18n';
	import Modal from '$lib/components/Modal.svelte';
	import Button from '$lib/components/Button.svelte';

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel,
		cancelLabel,
		danger = false,
		onconfirm,
		oncancel
	}: {
		open?: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		onconfirm: () => void;
		oncancel?: () => void;
	} = $props();

	function handleCancel() {
		oncancel?.();
		open = false;
	}

	function handleConfirm() {
		onconfirm();
		open = false;
	}
</script>

<Modal bind:open {title}>
	<p class="confirm-message">{message}</p>
	<div class="confirm-footer">
		<Button variant="ghost" onclick={handleCancel}>
			{cancelLabel ?? t('common.cancel')}
		</Button>
		<Button variant={danger ? 'danger' : 'primary'} onclick={handleConfirm}>
			{confirmLabel ?? t('common.confirm')}
		</Button>
	</div>
</Modal>

<style>
	.confirm-message {
		margin: 0 0 20px 0;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
		line-height: 1.5;
	}

	.confirm-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}
</style>
