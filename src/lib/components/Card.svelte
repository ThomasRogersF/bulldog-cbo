<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		elevation = 1,
		padding = 'md',
		children
	}: {
		elevation?: 1 | 2 | 3;
		padding?: 'none' | 'sm' | 'md' | 'lg';
		children: Snippet;
	} = $props();
</script>

<div
	class="card"
	class:elevation-1={elevation === 1}
	class:elevation-2={elevation === 2}
	class:elevation-3={elevation === 3}
	class:pad-none={padding === 'none'}
	class:pad-sm={padding === 'sm'}
	class:pad-md={padding === 'md'}
	class:pad-lg={padding === 'lg'}
>
	{@render children()}
</div>

<style>
	.card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-card);
	}

	/* Flat by default on dark; raised levels use dark-readable shadows. */
	.elevation-2 {
		box-shadow: 0 14px 26px -16px rgba(0, 0, 0, 0.8);
	}

	.elevation-3 {
		box-shadow: 0 18px 44px -14px rgba(0, 0, 0, 0.7);
	}

	.pad-none {
		padding: 0;
	}

	.pad-sm {
		padding: 12px;
	}

	.pad-md {
		padding: 20px;
	}

	.pad-lg {
		padding: 24px;
	}
</style>
