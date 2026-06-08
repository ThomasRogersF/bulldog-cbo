<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authStore, isOwner } from '$lib/stores/auth.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	// Send people to their landing screen once auth resolves.
	$effect(() => {
		if (authStore.ready) {
			void goto(isOwner() ? resolve('/dashboard') : resolve('/pos'));
		}
	});
</script>

<div class="root-redirect">
	<LoadingSpinner size="lg" />
</div>

<style>
	.root-redirect {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--color-surface-base);
	}
</style>
