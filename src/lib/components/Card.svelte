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
		background-color: var(--color-surface-raised);
		border-radius: var(--radius-lg);
	}

	.elevation-1 {
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.1),
			0 1px 2px rgba(0, 0, 0, 0.06);
	}

	.elevation-2 {
		box-shadow:
			0 4px 6px rgba(0, 0, 0, 0.1),
			0 2px 4px rgba(0, 0, 0, 0.06);
	}

	.elevation-3 {
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.12),
			0 4px 8px rgba(0, 0, 0, 0.08);
	}

	.pad-none {
		padding: 0;
	}

	.pad-sm {
		padding: 8px;
	}

	.pad-md {
		padding: 16px;
	}

	.pad-lg {
		padding: 24px;
	}
</style>
