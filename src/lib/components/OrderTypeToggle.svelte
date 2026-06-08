<script lang="ts">
	import { t } from '$lib/i18n';
	import type { OrderType } from '$lib/types';

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
		<span aria-hidden="true">🍽️</span>
		<span>{t('orderType.dine_in')}</span>
	</button>
	<button
		type="button"
		class="seg"
		class:selected={value === 'takeout'}
		aria-pressed={value === 'takeout'}
		onclick={() => (value = 'takeout')}
	>
		<span aria-hidden="true">🥡</span>
		<span>{t('orderType.takeout')}</span>
	</button>
</div>

<style>
	.toggle {
		display: flex;
		width: 100%;
		min-height: 48px;
		padding: 3px;
		gap: 3px;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
	}

	.seg {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 42px;
		padding: 0.5rem 0.75rem;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease,
			transform 150ms ease;
	}

	.seg:active {
		transform: scale(0.97);
	}

	.seg.selected {
		background: var(--color-accent);
		color: var(--color-accent-fg);
	}
</style>
