<script lang="ts">
	import type { MenuItem } from '$lib/types';
	import { formatUsd } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import Badge from '$lib/components/Badge.svelte';

	const {
		item,
		outOfStock = false,
		onadd
	}: { item: MenuItem; outOfStock?: boolean; onadd: (item: MenuItem) => void } = $props();
</script>

<button
	type="button"
	class="card relative w-full overflow-hidden text-left"
	aria-label={item.name}
	onclick={() => onadd(item)}
>
	<span
		class="accent-bar block w-full"
		style="background: {item.category_color || 'var(--color-accent)'};"
	></span>

	{#if outOfStock}
		<span class="absolute right-2 top-3">
			<Badge variant="danger">{t('pos.outOfStock')}</Badge>
		</span>
	{/if}

	<span class="body flex items-start gap-2">
		{#if item.category_emoji}
			<span class="emoji" aria-hidden="true">{item.category_emoji}</span>
		{/if}
		<span class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="name">{item.name}</span>
			<span class="price tabular-nums">{formatUsd(item.price_usd)}</span>
		</span>
	</span>
</button>

<style>
	.card {
		min-height: 96px;
		background: var(--color-surface-raised);
		border-radius: var(--radius-lg);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06);
		font-family: var(--font-sans);
		transition: transform 150ms ease;
	}
	.card:active {
		transform: scale(0.97);
	}

	.accent-bar {
		height: 6px;
	}

	.body {
		padding: 12px;
	}

	.emoji {
		font-size: 28px;
		line-height: 1;
	}

	.name {
		font-weight: 600;
		color: var(--color-text-primary);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.price {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--color-accent);
	}
</style>
