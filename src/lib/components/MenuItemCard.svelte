<script lang="ts">
	import type { MenuItem } from '$lib/types';
	import { formatUsd } from '$lib/utils/format';
	import { t } from '$lib/i18n';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import FoodGlyph, { categoryToGlyph } from '$lib/components/FoodGlyph.svelte';

	const {
		item,
		outOfStock = false,
		qtyInCart = 0,
		bsText,
		onadd
	}: {
		item: MenuItem;
		outOfStock?: boolean;
		qtyInCart?: number;
		bsText?: string;
		onadd: (item: MenuItem) => void;
	} = $props();

	const glyph = $derived(categoryToGlyph(item.category_name ?? item.name));
</script>

<button
	type="button"
	class="tile"
	class:tile--active={qtyInCart > 0}
	class:tile--oos={outOfStock}
	aria-label={item.name}
	onclick={() => onadd(item)}
>
	<span class="tile__img">
		<FoodGlyph name={glyph} size={34} />
		{#if item.category_name}<span class="tile__cat">{item.category_name}</span>{/if}
		{#if outOfStock}
			<span class="tile__oos"><Badge variant="danger">{t('pos.outOfStock')}</Badge></span>
		{:else if qtyInCart > 0}
			<span class="tile__count">{qtyInCart}</span>
		{/if}
	</span>

	<span class="tile__body">
		<span class="tile__name">{item.name}</span>
		{#if item.description}<span class="tile__desc">{item.description}</span>{/if}
		<span class="tile__price">
			<span class="tile__usd tabular-nums">{formatUsd(item.price_usd)}</span>
			{#if bsText}<span class="tile__bs tabular-nums">{bsText}</span>{/if}
		</span>
	</span>

	<span class="tile__add"><Icon name="plus" size={18} stroke={2.6} /></span>
</button>

<style>
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		text-align: left;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-tile);
		overflow: hidden;
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			transform 0.16s,
			border-color 0.16s,
			box-shadow 0.16s;
	}

	.tile:hover {
		border-color: var(--color-line-2);
		transform: translateY(-2px);
		box-shadow: 0 14px 26px -16px rgba(0, 0, 0, 0.8);
	}

	.tile--active {
		border-color: var(--color-mustard);
	}

	.tile--oos {
		opacity: 0.66;
	}

	.tile__img {
		position: relative;
		height: 98px;
		display: grid;
		place-items: center;
		background: radial-gradient(circle at 32% 26%, var(--color-surface-3), var(--color-surface));
		color: color-mix(in srgb, var(--color-mustard) 42%, transparent);
		border-bottom: 1px solid var(--color-line);
	}

	.tile__cat {
		position: absolute;
		bottom: 8px;
		left: 8px;
		font-size: 9.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-dim);
		background: rgba(0, 0, 0, 0.55);
		padding: 3px 7px;
		border-radius: 6px;
		backdrop-filter: blur(4px);
		z-index: 1;
	}

	.tile__count {
		position: absolute;
		top: 8px;
		right: 8px;
		min-width: 24px;
		height: 24px;
		border-radius: 7px;
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		font-weight: 800;
		font-size: 12px;
		display: grid;
		place-items: center;
		padding: 0 6px;
		z-index: 1;
	}

	.tile__oos {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 1;
	}

	.tile__body {
		padding: 12px 13px 14px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1;
	}

	.tile__name {
		font-weight: 700;
		font-size: 14.5px;
		color: var(--color-text);
	}

	.tile__desc {
		font-size: 11.5px;
		color: var(--color-text-faint);
		line-height: 1.3;
		margin-bottom: 8px;
		flex: 1;
	}

	.tile__price {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.tile__usd {
		font-weight: 800;
		font-size: 16px;
		color: var(--color-mustard);
	}

	.tile__bs {
		font-size: 11px;
		color: var(--color-text-faint);
	}

	.tile__add {
		position: absolute;
		bottom: 12px;
		right: 12px;
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		color: var(--color-text);
		display: grid;
		place-items: center;
		transition: 0.15s;
	}

	.tile:hover .tile__add {
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		border-color: var(--color-mustard);
	}
</style>
