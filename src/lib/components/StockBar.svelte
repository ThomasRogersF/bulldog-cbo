<script lang="ts">
	import { stockLevel, stockRatio } from '$lib/domain/stock';
	import { formatQty } from '$lib/utils/format';
	import type { Unit } from '$lib/types';

	const {
		current,
		min,
		unit,
		showValue = true
	}: { current: number; min: number; unit?: Unit; showValue?: boolean } = $props();

	const level = $derived(stockLevel(current, min));
	const ratio = $derived(stockRatio(current, min));
</script>

<div class="wrap">
	<div class="track">
		<div class="fill {level}" style:width="{ratio * 100}%"></div>
	</div>
	{#if showValue}
		<span class="value tabular-nums">{formatQty(current, unit)}</span>
	{/if}
</div>

<style>
	.wrap {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
	}

	.track {
		flex: 1;
		min-width: 0;
		height: 10px;
		background: var(--color-surface-3);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.fill.out {
		background: var(--color-red);
	}
	.fill.low {
		background: var(--color-amber);
	}
	.fill.ok {
		background: var(--color-green);
	}

	.value {
		flex-shrink: 0;
		font-weight: 700;
		font-size: 0.875rem;
		color: var(--color-text-dim);
		font-variant-numeric: tabular-nums;
	}
</style>
