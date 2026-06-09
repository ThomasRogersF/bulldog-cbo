<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

	let {
		value = $bindable(0),
		min = 0,
		max,
		onchange
	}: {
		value?: number;
		min?: number;
		max?: number;
		onchange?: (v: number) => void;
	} = $props();

	function decrement() {
		const next = Math.max(min, value - 1);
		if (next !== value) {
			value = next;
			onchange?.(next);
		}
	}

	function increment() {
		const ceiling = max ?? Infinity;
		const next = Math.min(ceiling, value + 1);
		if (next !== value) {
			value = next;
			onchange?.(next);
		}
	}

	const atMin = $derived(value <= min);
	const atMax = $derived(max !== undefined && value >= max);
</script>

<div class="stepper inline-flex items-center">
	<button type="button" class="stepper-btn" onclick={decrement} disabled={atMin} aria-label="−">
		<Icon name="minus" size={16} stroke={2.6} />
	</button>
	<span class="stepper-value tabular-nums">{value}</span>
	<button type="button" class="stepper-btn" onclick={increment} disabled={atMax} aria-label="+">
		<Icon name="plus" size={16} stroke={2.6} />
	</button>
</div>

<style>
	.stepper {
		gap: 2px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		border-radius: 10px;
		padding: 3px;
	}

	.stepper-btn {
		min-width: 44px;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--color-text);
		border: none;
		border-radius: 8px;
		font-family: var(--font-sans);
		line-height: 1;
		cursor: pointer;
		transition:
			background 150ms ease,
			opacity 150ms ease;
	}

	.stepper-btn:hover:not(:disabled) {
		background: var(--color-surface-3);
	}

	.stepper-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.stepper-value {
		min-width: 2ch;
		text-align: center;
		font-size: 18px;
		font-weight: 700;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}
</style>
