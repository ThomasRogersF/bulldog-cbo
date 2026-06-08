<script lang="ts">
	import { stockLevel, stockRatio } from '$lib/domain/stock';
	import { formatQty } from '$lib/utils/format';
	import type { Unit } from '$lib/types';

	const { current, min, unit }: { current: number; min: number; unit?: Unit } = $props();

	const level = $derived(stockLevel(current, min));
	const ratio = $derived(stockRatio(current, min));
</script>

<div class="wrap">
	<div class="track">
		<div class="fill {level}" style:width="{ratio * 100}%"></div>
	</div>
	<span class="value tabular-nums">{formatQty(current, unit)}</span>
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
		height: 8px;
		background: var(--color-surface-overlay);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		border-radius: var(--radius-full);
		transition: width 150ms ease;
	}

	.fill.out {
		background: var(--color-danger);
	}
	.fill.low {
		background: var(--color-warning);
	}
	.fill.ok {
		background: var(--color-success);
	}

	.value {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}
</style>
