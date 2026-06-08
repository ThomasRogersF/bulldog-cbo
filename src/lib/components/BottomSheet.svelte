<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n';

	let {
		open = $bindable(false),
		title,
		children
	}: {
		open?: boolean;
		title?: string;
		children: Snippet;
	} = $props();
</script>

{#if open}
	<div class="sheet-root">
		<button
			type="button"
			class="sheet-overlay"
			aria-label={t('common.close')}
			onclick={() => (open = false)}
		></button>
		<div class="sheet-panel" role="dialog" aria-modal="true" aria-label={title} tabindex="-1">
			<div class="sheet-handle" aria-hidden="true"></div>
			{#if title}
				<h2 class="sheet-title">{title}</h2>
			{/if}
			<div class="sheet-body">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.sheet-root {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.sheet-overlay {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		background: var(--color-overlay);
		backdrop-filter: blur(2px);
		cursor: pointer;
	}

	.sheet-panel {
		position: relative;
		width: 100%;
		max-width: 640px;
		max-height: 85vh;
		overflow-y: auto;
		padding: 16px;
		background: var(--color-surface-raised);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		border-top-left-radius: var(--radius-xl);
		border-top-right-radius: var(--radius-xl);
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.12),
			0 4px 8px rgba(0, 0, 0, 0.08);
		animation: sheet-up 150ms ease;
	}

	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.sheet-handle {
		width: 40px;
		height: 4px;
		margin: 0 auto 12px auto;
		border-radius: var(--radius-full);
		background: var(--color-text-muted);
		opacity: 0.4;
	}

	.sheet-title {
		margin: 0 0 12px 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.sheet-body {
		display: block;
	}
</style>
