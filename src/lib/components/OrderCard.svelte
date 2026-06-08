<script lang="ts">
	import type { Order } from '$lib/types';
	import { formatUsd, timeAgo } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';

	const {
		order,
		onclick,
		showElapsed = false
	}: { order: Order; onclick?: () => void; showElapsed?: boolean } = $props();
</script>

{#snippet body()}
	<div class="flex items-center gap-3">
		<span class="number">#{order.order_number}</span>

		{#if order.order_type === 'dine_in'}
			<Badge variant="info">{t('orderType.dine_in')}</Badge>
		{:else}
			<Badge variant="secondary">{t('orderType.takeout')}</Badge>
		{/if}

		{#if order.status !== 'open'}
			{#if order.status === 'confirmed'}
				<Badge variant="success">{t('status.confirmed')}</Badge>
			{:else}
				<Badge variant="danger">{t('status.cancelled')}</Badge>
			{/if}
		{/if}

		<span class="total tabular-nums ml-auto">{formatUsd(order.total_usd)}</span>
	</div>

	<div class="meta flex items-center gap-3">
		{#if order.worker_name}
			<span class="muted">{order.worker_name}</span>
		{/if}
		{#if showElapsed}
			<span class="muted ml-auto">{timeAgo(order.created_at)}</span>
		{/if}
	</div>
{/snippet}

{#if onclick}
	<button type="button" class="click-wrap w-full text-left" {onclick}>
		<Card>
			{@render body()}
		</Card>
	</button>
{:else}
	<Card>
		{@render body()}
	</Card>
{/if}

<style>
	.click-wrap {
		display: block;
		border-radius: var(--radius-lg);
		transition: transform 150ms ease;
		font-family: var(--font-sans);
	}
	.click-wrap:active {
		transform: scale(0.97);
	}

	.number {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.total {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--color-accent);
	}

	.meta {
		margin-top: 6px;
	}

	.muted {
		font-size: 13px;
		color: var(--color-text-muted);
	}
</style>
