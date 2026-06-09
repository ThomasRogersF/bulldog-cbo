<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { RouteId } from '$app/types';
	import { authStore, isOwner, signOut } from '$lib/stores/auth.svelte';
	import { shiftStore } from '$lib/stores/shift.svelte';
	import { navStore, visibleNav, toggleMobileMenu } from '$lib/stores/nav.svelte';
	import { t } from '$lib/i18n';

	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const role = $derived(authStore.profile?.role ?? null);
	const items = $derived(visibleNav(role));
	const primaryItems = $derived(items.filter((i) => i.primary));
	const moreItems = $derived(items.filter((i) => !i.primary));

	const initials = $derived.by(() => {
		const name = authStore.profile?.full_name ?? '';
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '··';
		return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
	});

	function isActive(path: string): boolean {
		return page.url.pathname === path;
	}

	function navTo(path: string) {
		void goto(resolve(path as RouteId));
	}

	function navFromSheet(path: string) {
		toggleMobileMenu(false);
		void goto(resolve(path as RouteId));
	}

	async function handleSignOut() {
		toggleMobileMenu(false);
		await signOut();
		await goto(resolve('/login'));
	}
</script>

<!-- DESKTOP SIDEBAR -->
<aside class="sidebar hidden lg:flex">
	<div class="sidebar__brand">
		<span class="logo-tile">
			<img src="/bulldog-logo.png" alt="Bulldog Hotdog" />
		</span>
		<div class="brand-text">
			<span class="brand-name">Bulldog</span>
			<span class="brand-sub">CBO · {t('nav.pos')}</span>
		</div>
	</div>

	<nav class="sidebar__nav" aria-label="Principal">
		{#each items as item (item.href)}
			<a
				href={resolve(item.href as RouteId)}
				class="navitem"
				class:navitem--on={isActive(item.href)}
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				<span class="navitem__icon"><Icon name={item.icon} size={20} /></span>
				<span class="navitem__label">{t(item.labelKey)}</span>
				{#if isActive(item.href)}<span class="navitem__dot"></span>{/if}
			</a>
		{/each}
	</nav>

	<div class="sidebar__foot">
		{#if shiftStore.active}
			<div class="shift-chip">
				<span class="dot-live"></span>
				<span>{t('shifts.number')} #{shiftStore.active.shift_number} {t('shifts.active')}</span>
			</div>
		{:else}
			<div class="shift-chip shift-chip--off">
				<span>{t('shifts.noActive')}</span>
			</div>
		{/if}

		{#if authStore.profile}
			<div class="user-row">
				<span class="avatar">{initials}</span>
				<div class="user-meta">
					<span class="user-name">{authStore.profile.full_name}</span>
					<span class="user-role">{t('role.' + authStore.profile.role)}</span>
				</div>
				<Badge variant={isOwner() ? 'accent' : 'neutral'} icon={isOwner() ? 'crown' : undefined}>
					{t('role.' + authStore.profile.role)}
				</Badge>
			</div>
		{/if}

		<Button variant="ghost" full onclick={handleSignOut}>
			{t('nav.signOut')}
		</Button>
	</div>
</aside>

<!-- MOBILE BOTTOM NAV -->
<nav class="mobilenav lg:hidden" aria-label="Principal">
	{#each primaryItems as item (item.href)}
		<button
			type="button"
			class="mnav"
			class:mnav--on={isActive(item.href)}
			aria-current={isActive(item.href) ? 'page' : undefined}
			onclick={() => navTo(item.href)}
		>
			<Icon name={item.icon} size={22} />
			<span>{t(item.labelKey)}</span>
		</button>
	{/each}
	<button
		type="button"
		class="mnav"
		class:mnav--on={navStore.mobileMenuOpen}
		onclick={() => toggleMobileMenu()}
	>
		<Icon name="more" size={22} />
		<span>{t('nav.more')}</span>
	</button>
</nav>

<!-- MOBILE "MÁS" SHEET -->
<BottomSheet bind:open={navStore.mobileMenuOpen} title={t('nav.more')}>
	<div class="flex flex-col gap-2">
		{#each moreItems as item (item.href)}
			<button
				type="button"
				class="sheet-link"
				class:active={isActive(item.href)}
				onclick={() => navFromSheet(item.href)}
			>
				<span class="navitem__icon"><Icon name={item.icon} size={20} /></span>
				<span>{t(item.labelKey)}</span>
			</button>
		{/each}

		{#if authStore.profile}
			<div class="sheet-user">
				<span class="user-name">{authStore.profile.full_name}</span>
				<Badge variant={isOwner() ? 'accent' : 'neutral'} icon={isOwner() ? 'crown' : undefined}>
					{t('role.' + authStore.profile.role)}
				</Badge>
			</div>
		{/if}

		<Button variant="ghost" full onclick={handleSignOut}>
			{t('nav.signOut')}
		</Button>
	</div>
</BottomSheet>

<style>
	/* ── Desktop sidebar ─────────────────────────────────────── */
	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: 40;
		width: 250px;
		flex-direction: column;
		background: var(--color-surface);
		border-right: 1px solid var(--color-line);
		font-family: var(--font-sans);
	}

	.sidebar__brand {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 18px 18px 16px;
		border-bottom: 1px solid var(--color-line);
	}

	.logo-tile {
		display: grid;
		place-items: center;
		overflow: hidden;
		flex: none;
		width: 42px;
		height: 42px;
		border-radius: 11px;
		box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--color-mustard) 55%, transparent);
	}

	.logo-tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1;
		min-width: 0;
	}

	.brand-name {
		font-weight: 900;
		font-size: 20px;
		letter-spacing: -0.02em;
		color: var(--color-text);
	}

	.brand-sub {
		font-size: 10px;
		color: var(--color-text-faint);
		margin-top: 5px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 600;
	}

	.sidebar__nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		flex: 1;
		overflow-y: auto;
	}

	.navitem {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 11px 13px;
		border-radius: 11px;
		color: var(--color-text-dim);
		font-weight: 600;
		font-size: 14.5px;
		position: relative;
		transition:
			background 0.15s,
			color 0.15s;
		text-align: left;
		text-decoration: none;
	}

	.navitem:hover {
		background: var(--color-surface-2);
		color: var(--color-text);
	}

	.navitem--on {
		background: var(--color-mustard-soft);
		color: var(--color-mustard);
	}

	.navitem__icon {
		display: grid;
		place-items: center;
		flex: none;
	}

	.navitem__label {
		flex: 1;
	}

	.navitem__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-mustard);
	}

	.sidebar__foot {
		padding: 14px;
		border-top: 1px solid var(--color-line);
		display: flex;
		flex-direction: column;
		gap: 13px;
	}

	.shift-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		font-weight: 700;
		color: var(--color-green);
		background: color-mix(in srgb, var(--color-green) 10%, transparent);
		padding: 7px 11px;
		border-radius: 9px;
		align-self: flex-start;
		white-space: nowrap;
	}

	.shift-chip--off {
		color: var(--color-text-dim);
		background: var(--color-surface-2);
	}

	.user-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.avatar {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--color-mustard);
		color: var(--color-accent-fg);
		font-weight: 800;
		font-size: 14px;
		display: grid;
		place-items: center;
		flex: none;
	}

	.user-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.user-name {
		font-weight: 700;
		font-size: 13.5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--color-text);
	}

	.user-role {
		font-size: 11px;
		color: var(--color-text-faint);
	}

	/* ── Mobile bottom nav ───────────────────────────────────── */
	.mobilenav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		display: flex;
		height: 66px;
		background: color-mix(in srgb, var(--color-surface) 94%, transparent);
		backdrop-filter: blur(14px);
		border-top: 1px solid var(--color-line);
		font-family: var(--font-sans);
	}

	.mnav {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		border: none;
		background: transparent;
		color: var(--color-text-faint);
		font-family: var(--font-sans);
		font-size: 10.5px;
		font-weight: 600;
		cursor: pointer;
		transition: color 0.15s;
	}

	.mnav:active {
		transform: scale(0.95);
	}

	.mnav--on {
		color: var(--color-mustard);
	}

	/* ── "Más" sheet links ───────────────────────────────────── */
	.sheet-link {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 0 12px;
		border: none;
		border-radius: 11px;
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 15px;
		text-align: left;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.sheet-link:hover {
		background: var(--color-surface-2);
	}

	.sheet-link:active {
		transform: scale(0.98);
	}

	.sheet-link.active {
		background: var(--color-mustard-soft);
		color: var(--color-mustard);
	}

	.sheet-user {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		margin-top: 4px;
		border-top: 1px solid var(--color-line);
	}
</style>
