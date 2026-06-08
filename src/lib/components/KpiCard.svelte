<script lang="ts">
	import Card from '$lib/components/Card.svelte';

	const { icon, label, value, sub }: { icon?: string; label: string; value: string; sub?: string } =
		$props();
</script>

<Card>
	<div class="flex flex-col gap-1">
		{#if icon}
			<span class="icon" aria-hidden="true">{icon}</span>
		{/if}
		<span class="label">{label}</span>
		<span class="value tabular-nums">{value}</span>
		{#if sub}
			<span class="sub">{sub}</span>
		{/if}
	</div>
</Card>

<style>
	.icon {
		font-size: 24px;
		line-height: 1;
	}

	.label {
		font-size: 13px;
		letter-spacing: 0.03em;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}

	.value {
		font-size: 28px;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--color-text-primary);
		line-height: 1.1;
	}

	.sub {
		font-size: 12px;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}
</style>
