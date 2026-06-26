<script lang="ts">
	import { page } from '$app/state';
	import { shiftStore } from '$lib/stores/shift.svelte';
	import { toggleMobileMenu } from '$lib/stores/nav.svelte';
	import { settingsDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';

	// Route → page title/subtitle (kept in the i18n catalog).
	const TITLES: Record<string, string> = {
		'/dashboard': 'dashboard.title',
		'/pos': 'pos.title',
		'/orders': 'orders.title',
		'/ingredients': 'ingredients.title',
		'/menu': 'menu.title',
		'/customers': 'customers.title',
		'/shifts': 'shifts.title',
		'/users': 'users.title',
		'/settings': 'settings.title'
	};
	const SUBTITLES: Record<string, string> = {
		'/dashboard': 'pageSubtitle.dashboard',
		'/pos': 'pageSubtitle.pos',
		'/orders': 'pageSubtitle.orders',
		'/ingredients': 'pageSubtitle.ingredients',
		'/menu': 'pageSubtitle.menu',
		'/customers': 'pageSubtitle.customers',
		'/shifts': 'pageSubtitle.shifts',
		'/users': 'pageSubtitle.users',
		'/settings': 'pageSubtitle.settings'
	};

	function matchRoute(path: string): string | null {
		if (TITLES[path]) return path;
		const hit = Object.keys(TITLES).find((p) => path === p || path.startsWith(p + '/'));
		return hit ?? null;
	}

	const title = $derived.by(() => {
		const key = matchRoute(page.url.pathname);
		return key ? t(TITLES[key]) : t('app.name');
	});
	const subtitle = $derived.by(() => {
		const key = matchRoute(page.url.pathname);
		return key ? t(SUBTITLES[key]) : '';
	});

	// Best-effort exchange-rate chip (read-only; hidden if unavailable).
	let rate = $state<string | null>(null);
	$effect(() => {
		let cancelled = false;
		settingsDb
			.get('usd_rate')
			.then((r) => {
				if (!cancelled) rate = r;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});
	const rateText = $derived.by(() => {
		const n = Number(rate);
		return rate != null && rate !== '' && !Number.isNaN(n) ? n.toFixed(2) : null;
	});
</script>

<header class="topbar">
	<div class="topbar__left">
		<button
			type="button"
			class="topbar__menu lg:hidden"
			aria-label={t('nav.more')}
			onclick={() => toggleMobileMenu(true)}
		>
			<Icon name="more" size={22} />
		</button>
		<div class="topbar__titles">
			<h1 class="topbar__title">{title}</h1>
			{#if subtitle}<p class="topbar__sub">{subtitle}</p>{/if}
		</div>
	</div>
	<div class="topbar__right">
		{#if rateText}
			<div class="rate-chip" title={t('pos.usdRate')}>
				<Icon name="swap" size={15} />
				<span>Bs <b>{rateText}</b></span>
			</div>
		{/if}
		{#if shiftStore.active}
			<Badge variant="success" icon="clock"
				>{t('shifts.number')} #{shiftStore.active.shift_number}</Badge
			>
		{:else}
			<Badge variant="warning" icon="alert">{t('shifts.noActive')}</Badge>
		{/if}
	</div>
</header>

<style>
	.topbar {
		flex: none;
		position: sticky;
		top: 0;
		z-index: 20;
		/* Extend under the iOS status bar (black-translucent); keep 70px of content. */
		height: calc(70px + env(safe-area-inset-top));
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: env(safe-area-inset-top) 26px 0;
		border-bottom: 1px solid var(--color-line);
		background: color-mix(in srgb, var(--color-bg) 72%, transparent);
		backdrop-filter: blur(10px);
		font-family: var(--font-sans);
	}

	.topbar__left {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}

	.topbar__menu {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border-radius: 10px;
		color: var(--color-text);
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.topbar__titles {
		min-width: 0;
	}

	.topbar__title {
		font-size: 21px;
		font-weight: 800;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--color-text);
	}

	.topbar__sub {
		font-size: 12.5px;
		color: var(--color-text-faint);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.topbar__right {
		display: flex;
		align-items: center;
		gap: 11px;
		flex: none;
	}

	.rate-chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12.5px;
		color: var(--color-text-dim);
		background: var(--color-surface-2);
		border: 1px solid var(--color-line);
		padding: 8px 12px;
		border-radius: 9px;
		font-weight: 500;
		white-space: nowrap;
	}

	.rate-chip b {
		color: var(--color-text);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.topbar {
			padding: env(safe-area-inset-top) 16px 0;
		}
		.topbar__sub {
			display: none;
		}
	}
</style>
