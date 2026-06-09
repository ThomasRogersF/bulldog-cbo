<script lang="ts">
	import { t } from '$lib/i18n';
	import type { OrderType } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';

	let { value = $bindable('takeout') }: { value?: OrderType } = $props();
</script>

<div class="toggle" role="group">
	<button
		type="button"
		class="seg"
		class:selected={value === 'dine_in'}
		aria-pressed={value === 'dine_in'}
		onclick={() => (value = 'dine_in')}
	>
		<Icon name="utensils" size={18} />
		<span>{t('orderType.dine_in')}</span>
	</button>
	<button
		type="button"
		class="seg"
		class:selected={value === 'takeout'}
		aria-pressed={value === 'takeout'}
		onclick={() => (value = 'takeout')}
	>
		<Icon name="bag" size={18} />
		<span>{t('orderType.takeout')}</span>
	</button>
</div>

<style>
	.toggle {
		display: grid;
		grid-template-columns: 1fr 1fr;
		width: 100%;
		padding: 5px;
		gap: 6px;
		border: 1px solid var(--color-line);
		border-radius: 13px;
		background: var(--color-surface-2);
	}

	.seg {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 48px;
		padding: 12px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--color-text-dim);
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.seg:hover {
		color: var(--color-text);
	}

	.seg.selected {
		background: var(--color-mustard);
		color: var(--color-accent-fg);
	}
</style>
