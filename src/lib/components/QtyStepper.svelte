<script lang="ts">
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

<div class="stepper inline-flex items-center gap-2">
	<button type="button" class="stepper-btn" onclick={decrement} disabled={atMin} aria-label="−">
		−
	</button>
	<span class="stepper-value tabular-nums">{value}</span>
	<button type="button" class="stepper-btn" onclick={increment} disabled={atMax} aria-label="+">
		+
	</button>
</div>

<style>
	.stepper-btn {
		min-width: 44px;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface-overlay);
		color: var(--color-text-primary);
		border: none;
		border-radius: var(--radius-md);
		font-size: 20px;
		font-family: var(--font-sans);
		line-height: 1;
		cursor: pointer;
		transition:
			transform 150ms ease,
			opacity 150ms ease;
	}

	.stepper-btn:active {
		transform: scale(0.95);
	}

	.stepper-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.stepper-value {
		min-width: 2ch;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 18px;
		color: var(--color-text-primary);
		font-variant-numeric: tabular-nums;
	}
</style>
