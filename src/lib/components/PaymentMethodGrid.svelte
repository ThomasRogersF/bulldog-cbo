<script lang="ts">
	import { t } from '$lib/i18n';
	import type { PaymentMethod } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';

	let { value = $bindable(null) }: { value?: PaymentMethod | null } = $props();

	const METHODS: { method: PaymentMethod; icon: string }[] = [
		{ method: 'cash_usd', icon: 'cash' },
		{ method: 'cash_bs', icon: 'coin' },
		{ method: 'card', icon: 'card' },
		{ method: 'pagomovil', icon: 'phone' },
		{ method: 'transfer', icon: 'bank' },
		{ method: 'zinli', icon: 'wallet' },
		{ method: 'binance', icon: 'coin' },
		{ method: 'paypal', icon: 'globe' },
		{ method: 'credit', icon: 'creditclock' }
	];

	function toggle(method: PaymentMethod): void {
		value = value === method ? null : method;
	}
</script>

<div class="paygrid" role="group">
	{#each METHODS as { method, icon } (method)}
		<button
			type="button"
			class="pay"
			class:selected={value === method}
			aria-pressed={value === method}
			onclick={() => toggle(method)}
		>
			<Icon name={icon} size={18} />
			<span class="label">{t('payment.' + method)}</span>
		</button>
	{/each}
</div>

<style>
	.paygrid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.pay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 66px;
		padding: 11px 6px;
		border: 1px solid var(--color-line);
		border-radius: 11px;
		background: var(--color-surface-2);
		color: var(--color-text-dim);
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		text-align: center;
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background 140ms ease,
			color 140ms ease;
	}

	.pay:hover {
		border-color: var(--color-line-2);
		color: var(--color-text);
	}

	.pay.selected {
		background: var(--color-mustard-soft);
		border-color: var(--color-mustard);
		color: var(--color-mustard);
	}

	.label {
		line-height: 1.1;
	}
</style>
