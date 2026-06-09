<script lang="ts">
	import Card from '$lib/components/Card.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const { icon, label, value, sub }: { icon?: string; label: string; value: string; sub?: string } =
		$props();
</script>

<Card>
	<div class="kpi">
		{#if icon}
			<div class="kpi-top">
				<span class="kpi-icon"><Icon name={icon} size={19} /></span>
			</div>
		{/if}
		<span class="label">{label}</span>
		<span class="value tabular-nums">{value}</span>
		{#if sub}
			<span class="sub">{sub}</span>
		{/if}
	</div>
</Card>

<style>
	.kpi {
		position: relative;
		overflow: hidden;
	}

	.kpi-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18px;
	}

	.kpi-icon {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--color-mustard-soft);
		color: var(--color-mustard);
		display: grid;
		place-items: center;
	}

	.label {
		display: block;
		font-size: 11.5px;
		color: var(--color-text-dim);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: var(--font-sans);
	}

	.value {
		display: block;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: -0.025em;
		margin-top: 7px;
		color: var(--color-text);
		font-family: var(--font-sans);
		line-height: 1.1;
	}

	.sub {
		display: block;
		font-size: 12.5px;
		color: var(--color-text-faint);
		margin-top: 5px;
		font-family: var(--font-sans);
	}
</style>
