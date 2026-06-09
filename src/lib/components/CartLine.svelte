<script lang="ts">
	import { formatUsd } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';

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

<div class="cartline">
	<div class="cartline__info">
		<span class="name">{name}</span>
		{#if override}
			<span class="override">
				<Icon name="alert" size={13} stroke={2.4} />
				<Badge variant="warning">{t('pos.overrideTitle')}</Badge>
			</span>
		{/if}
	</div>

	<div class="stepper">
		<button type="button" class="step" aria-label={t('common.delete')} onclick={ondec}>
			<Icon name="minus" size={15} stroke={2.6} />
		</button>
		<span class="qty tabular-nums">{qty}</span>
		<button type="button" class="step" aria-label={t('common.add')} onclick={oninc}>
			<Icon name="plus" size={15} stroke={2.6} />
		</button>
	</div>

	<span class="total tabular-nums">{formatUsd(lineTotal)}</span>

	{#if onremove}
		<button type="button" class="trash" aria-label={t('common.delete')} onclick={onremove}>
			<Icon name="trash" size={16} />
		</button>
	{/if}
</div>

<style>
	.cartline {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 9px 8px;
		border-radius: 11px;
		font-family: var(--font-sans);
		transition: background 120ms ease;
	}

	.cartline:hover {
		background: var(--color-surface-2);
	}

	.cartline__info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		font-weight: 700;
		font-size: 14px;
		color: var(--color-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.override {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--color-amber);
	}

	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		border-radius: 10px;
		padding: 3px;
	}

	.step {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border-radius: 7px;
		color: var(--color-text);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background 120ms ease;
	}
	.step:hover {
		background: var(--color-surface-3);
	}

	.qty {
		min-width: 26px;
		text-align: center;
		font-weight: 700;
		font-size: 14px;
		color: var(--color-text);
	}

	.total {
		min-width: 52px;
		text-align: right;
		font-weight: 800;
		font-size: 14px;
		color: var(--color-text);
	}

	.trash {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border-radius: 8px;
		color: var(--color-text-faint);
		background: transparent;
		border: none;
		cursor: pointer;
		transition:
			background 120ms ease,
			color 120ms ease;
	}
	.trash:hover {
		background: color-mix(in srgb, var(--color-red) 14%, transparent);
		color: var(--color-red);
	}
</style>
