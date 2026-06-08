<script lang="ts">
	const {
		size = 'md'
	}: {
		size?: 'sm' | 'md' | 'lg';
	} = $props();
</script>

<span
	class="spinner"
	class:size-sm={size === 'sm'}
	class:size-md={size === 'md'}
	class:size-lg={size === 'lg'}
	role="status"
	aria-label="loading"
></span>

<style>
	.spinner {
		display: inline-block;
		border-style: solid;
		border-color: var(--color-surface-overlay);
		border-top-color: var(--color-accent);
		border-radius: var(--radius-full);
		animation: spin 0.7s linear infinite;
	}

	.size-sm {
		width: 16px;
		height: 16px;
		border-width: 2px;
	}

	.size-md {
		width: 24px;
		height: 24px;
		border-width: 3px;
	}

	.size-lg {
		width: 40px;
		height: 40px;
		border-width: 4px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
