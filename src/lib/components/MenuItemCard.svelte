<script lang="ts">
	import { untrack } from 'svelte';
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
	let showGlyph = $state(untrack(() => !item.image_url));
</script>

<button
	type="button"
	class="tile"
	class:tile--in-cart={qtyInCart > 0}
	class:tile--oos={outOfStock}
	aria-label={item.name}
	onclick={() => onadd(item)}
>
	<!-- IMAGE AREA -->
	<span class="tile__img" class:tile__img--photo={!!item.image_url}>
		{#if item.image_url && !showGlyph}
			<img
				src={item.image_url}
				alt={item.name}
				loading="lazy"
				onerror={() => {
					showGlyph = true;
				}}
			/>
		{:else}
			<FoodGlyph name={glyph} size={34} />
		{/if}

		{#if item.category_name}<span class="tile__cat">{item.category_name}</span>{/if}
		{#if outOfStock}
			<span class="tile__oos"><Badge variant="danger">{t('pos.outOfStock')}</Badge></span>
		{:else if qtyInCart > 0}
			<span class="tile__badge">{qtyInCart}</span>
		{/if}
	</span>

	<!-- TEXT AREA -->
	<span class="tile__body">
		<span class="tile__name">{item.name}</span>
		{#if item.description}<span class="tile__desc">{item.description}</span>{/if}
		<span class="tile__footer">
			<span class="tile__prices">
				<span class="tile__price tabular-nums">{formatUsd(item.price_usd)}</span>
				{#if bsText}<span class="tile__bs tabular-nums">{bsText}</span>{/if}
			</span>
			<span class="tile__add"><Icon name="plus" size={18} stroke={2.6} /></span>
		</span>
	</span>
</button>

<style>
	.tile {
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

	.tile--in-cart {
		border-color: var(--color-mustard);
	}

	.tile--oos {
		opacity: 0.66;
	}

	/* IMAGE AREA — fixed aspect ratio, clips photo to rounded top corners */
	.tile__img {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		flex-shrink: 0;
		background: radial-gradient(circle at 32% 26%, var(--color-surface-3), var(--color-surface));
		color: color-mix(in srgb, var(--color-mustard) 42%, transparent);
		border-bottom: 1px solid var(--color-line);
	}

	.tile__img--photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 30%;
		display: block;
	}

	.tile__img--photo::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 56px;
		background: linear-gradient(transparent, rgba(16, 15, 13, 0.92));
		pointer-events: none;
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
		background: var(--color-surface);
		padding: 3px 7px;
		border-radius: 6px;
		z-index: 1;
	}

	.tile__badge {
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
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 6px;
		z-index: 1;
	}

	.tile__oos {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 1;
	}

	/* TEXT AREA — sits below image, never overlaps */
	.tile__body {
		padding: 12px 13px 14px;
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1;
		background: var(--color-surface);
	}

	.tile__name {
		font-weight: 700;
		font-size: 14.5px;
		color: var(--color-text);
		line-height: 1.3;
	}

	.tile__desc {
		font-size: 11.5px;
		color: var(--color-text-faint);
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		overflow: hidden;
	}

	.tile__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 6px;
	}

	.tile__prices {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.tile__price {
		font-weight: 800;
		font-size: 16px;
		color: var(--color-mustard);
		line-height: 1;
	}

	.tile__bs {
		font-size: 11px;
		color: var(--color-text-faint);
	}

	.tile__add {
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		color: var(--color-text);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: 0.15s;
	}

	.tile:hover .tile__add {
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		border-color: var(--color-mustard);
	}
</style>
