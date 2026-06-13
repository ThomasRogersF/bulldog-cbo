<script lang="ts">
	import { t } from '$lib/i18n';
	import {
		installStore,
		initInstall,
		triggerInstall,
		dismissInstall
	} from '$lib/stores/install.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';

	// Detect platform / attach listeners on mount (idempotent with the layout call).
	$effect(() => {
		initInstall();
	});
</script>

{#if installStore.visible && installStore.platform !== 'none'}
	<aside class="install" aria-label={t('install.title')}>
		<button
			type="button"
			class="install__close"
			aria-label={t('common.close')}
			onclick={dismissInstall}
		>
			<Icon name="x" size={18} />
		</button>

		<div class="install__head">
			<span class="install__emoji" aria-hidden="true">🐕</span>
			<p class="install__title">{t('install.title')}</p>
		</div>

		{#if installStore.platform === 'installable'}
			<p class="install__desc">{t('install.androidDesc')}</p>
			<div class="install__actions">
				<Button size="sm" onclick={triggerInstall}>{t('install.installBtn')}</Button>
				<Button size="sm" variant="ghost" onclick={dismissInstall}>
					{t('install.dismissBtn')}
				</Button>
			</div>
		{:else}
			<p class="install__desc">{t('install.iosDesc')}</p>
			<div class="install__actions">
				<Button size="sm" variant="ghost" onclick={dismissInstall}>
					{t('install.gotItBtn')}
				</Button>
			</div>
		{/if}
	</aside>
{/if}

<style>
	.install {
		position: fixed;
		z-index: 45; /* below modals (50), above bottom nav (40) */
		left: 16px;
		right: 16px;
		/* Clear the 66px mobile bottom nav + the iOS home indicator. */
		bottom: calc(76px + env(safe-area-inset-bottom));
		max-width: 420px;
		margin: 0 auto;
		padding: 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-card);
		box-shadow: 0 18px 44px -14px rgba(0, 0, 0, 0.7);
		font-family: var(--font-sans);
		animation: install-rise 220ms ease;
	}

	/* No bottom nav on desktop — sit just above the viewport edge, centered. */
	@media (min-width: 1024px) {
		.install {
			bottom: 16px;
		}
	}

	.install__close {
		position: absolute;
		top: 10px;
		right: 10px;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: var(--radius-full);
		background: transparent;
		color: var(--color-text-faint);
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.install__close:hover {
		background: var(--color-surface-2);
		color: var(--color-text);
	}

	.install__head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-right: 32px; /* leave room for the close button */
	}

	.install__emoji {
		font-size: 22px;
		line-height: 1;
	}

	.install__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: var(--color-text);
	}

	.install__desc {
		margin: 8px 0 14px;
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--color-text-dim);
	}

	.install__actions {
		display: flex;
		gap: 10px;
	}

	@keyframes install-rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
