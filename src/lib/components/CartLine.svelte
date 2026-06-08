<script lang="ts">
	import { formatUsd } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import Badge from '$lib/components/Badge.svelte';

	const {
		name,
		qty,
		lineTotal,
		override = false,
		oninc,
		ondec,
		onremove
	}: {
		name: string;
		qty: number;
		lineTotal: number;
		override?: boolean;
		oninc: () => void;
		ondec: () => void;
		onremove?: () => void;
	} = $props();
</script>

<div class="row flex items-center gap-3">
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<span class="name">{name}</span>
		{#if override}
			<span class="flex items-center gap-1">
				<span aria-hidden="true">⚠️</span>
				<Badge variant="warning">{t('pos.overrideTitle')}</Badge>
			</span>
		{/if}
	</div>

	<div class="stepper flex items-center">
		<button type="button" class="step" aria-label={t('common.delete')} onclick={ondec}>−</button>
		<span class="qty tabular-nums">{qty}</span>
		<button type="button" class="step" aria-label={t('common.add')} onclick={oninc}>+</button>
	</div>

	<span class="total tabular-nums">{formatUsd(lineTotal)}</span>

	{#if onremove}
		<button type="button" class="trash" aria-label={t('common.delete')} onclick={onremove}
			>🗑️</button
		>
	{/if}
</div>

<style>
	.row {
		min-height: 48px;
		padding: 6px 0;
		font-family: var(--font-sans);
	}

	.name {
		font-weight: 600;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stepper {
		gap: 4px;
	}

	.step {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		font-weight: 600;
		color: var(--color-text-primary);
		background: var(--color-surface-base);
		border-radius: var(--radius-md);
		transition: transform 150ms ease;
	}
	.step:active {
		transform: scale(0.95);
	}

	.qty {
		min-width: 28px;
		text-align: center;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.total {
		min-width: 64px;
		text-align: right;
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.trash {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		border-radius: var(--radius-md);
		transition: transform 150ms ease;
	}
	.trash:active {
		transform: scale(0.95);
	}
</style>
