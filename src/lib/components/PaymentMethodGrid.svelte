<script lang="ts">
	import { t } from '$lib/i18n';
	import type { PaymentMethod } from '$lib/types';

	let { value = $bindable(null) }: { value?: PaymentMethod | null } = $props();

	const METHODS: { method: PaymentMethod; icon: string }[] = [
		{ method: 'cash_usd', icon: '💵' },
		{ method: 'cash_bs', icon: '💵' },
		{ method: 'card', icon: '💳' },
		{ method: 'pagomovil', icon: '📱' },
		{ method: 'transfer', icon: '🏦' },
		{ method: 'zinli', icon: '🟣' },
		{ method: 'binance', icon: '🟡' },
		{ method: 'paypal', icon: '🅿️' },
		{ method: 'credit', icon: '📒' }
	];

	function toggle(method: PaymentMethod): void {
		value = value === method ? null : method;
	}
</script>

<div class="grid grid-cols-3 gap-2" role="group">
	{#each METHODS as { method, icon } (method)}
		<button
			type="button"
			class="method"
			class:selected={value === method}
			aria-pressed={value === method}
			onclick={() => toggle(method)}
		>
			<span class="icon" aria-hidden="true">{icon}</span>
			<span class="label">{t('payment.' + method)}</span>
		</button>
	{/each}
</div>

<style>
	.method {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 56px;
		padding: 0.5rem 0.375rem;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-raised);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			transform 150ms ease;
	}

	.method:active {
		transform: scale(0.97);
	}

	.method.selected {
		border: 2px solid var(--color-accent);
		background: color-mix(in srgb, var(--color-secondary) 18%, var(--color-surface-raised));
	}

	.icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.label {
		font-size: 0.75rem;
		line-height: 1.1;
		text-align: center;
	}
</style>
