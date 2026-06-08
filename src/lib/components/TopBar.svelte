<script lang="ts">
	import { shiftStore } from '$lib/stores/shift.svelte';
	import { t } from '$lib/i18n';
	import Badge from '$lib/components/Badge.svelte';
</script>

<header class="topbar lg:hidden">
	<div class="brand">
		<span aria-hidden="true">🌭</span>
		<span class="wordmark">Bulldog CBO</span>
	</div>
	<div class="pill">
		{#if shiftStore.active}
			<Badge variant="success">{t('shifts.number')} #{shiftStore.active.shift_number}</Badge>
		{:else}
			<Badge variant="warning">{t('shifts.noActive')}</Badge>
		{/if}
	</div>
</header>

<style>
	.topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		padding: 0 16px;
		background: var(--color-surface-raised);
		font-family: var(--font-sans);
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 18px;
	}

	.wordmark {
		font-weight: 700;
		color: var(--color-accent);
	}
</style>
