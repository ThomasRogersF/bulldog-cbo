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

	const role = $derived(authStore.profile?.role ?? null);
	const items = $derived(visibleNav(role));
	const primaryItems = $derived(items.filter((i) => i.primary));
	const moreItems = $derived(items.filter((i) => !i.primary));

	function isActive(path: string): boolean {
		return page.url.pathname === path;
	}

	function navTo(path: string) {
		// Nav hrefs are always valid app routes (see NAV_ITEMS).
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
	<div class="sidebar-brand">
		<span aria-hidden="true">🌭</span>
		<span class="wordmark">Bulldog CBO</span>
	</div>

	<nav class="sidebar-nav" aria-label="Principal">
		{#each items as item (item.href)}
			<a
				href={resolve(item.href as RouteId)}
				class="nav-link"
				class:active={isActive(item.href)}
				aria-current={isActive(item.href) ? 'page' : undefined}
			>
				<span class="nav-icon" aria-hidden="true">{item.icon}</span>
				<span class="nav-label">{t(item.labelKey)}</span>
			</a>
		{/each}
	</nav>

	<div class="sidebar-footer">
		<div class="shift-pill">
			{#if shiftStore.active}
				<Badge variant="success">{t('shifts.number')} #{shiftStore.active.shift_number}</Badge>
			{:else}
				<Badge variant="warning">{t('shifts.noActive')}</Badge>
			{/if}
		</div>

		{#if authStore.profile}
			<div class="user-row">
				<span class="user-name">{authStore.profile.full_name}</span>
				<Badge variant={isOwner() ? 'accent' : 'neutral'}>
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
<nav class="bottom-nav lg:hidden" aria-label="Principal">
	{#each primaryItems as item (item.href)}
		<button
			type="button"
			class="bottom-item"
			class:active={isActive(item.href)}
			aria-current={isActive(item.href) ? 'page' : undefined}
			onclick={() => navTo(item.href)}
		>
			<span class="bottom-icon" aria-hidden="true">{item.icon}</span>
			<span class="bottom-label">{t(item.labelKey)}</span>
		</button>
	{/each}
	<button
		type="button"
		class="bottom-item"
		class:active={navStore.mobileMenuOpen}
		onclick={() => toggleMobileMenu()}
	>
		<span class="bottom-icon" aria-hidden="true">☰</span>
		<span class="bottom-label">{t('nav.more')}</span>
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
				<span class="nav-icon" aria-hidden="true">{item.icon}</span>
				<span>{t(item.labelKey)}</span>
			</button>
		{/each}

		{#if authStore.profile}
			<div class="sheet-user">
				<span class="user-name">{authStore.profile.full_name}</span>
				<Badge variant={isOwner() ? 'accent' : 'neutral'}>
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
		width: 240px;
		flex-direction: column;
		background: var(--color-surface-raised);
		border-right: 1px solid var(--color-surface-overlay);
		font-family: var(--font-sans);
	}

	.sidebar-brand {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 20px 16px;
		font-size: 20px;
		font-weight: 700;
	}

	.sidebar-brand .wordmark {
		color: var(--color-accent);
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		overflow-y: auto;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 0 12px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		text-decoration: none;
		font-weight: 600;
		font-size: 15px;
		transition: all 150ms ease;
	}

	.nav-link:hover {
		background: var(--color-surface-overlay);
		color: var(--color-text-primary);
	}

	.nav-link.active {
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		color: var(--color-accent);
	}

	.nav-icon {
		font-size: 18px;
		line-height: 1;
	}

	.sidebar-footer {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		border-top: 1px solid var(--color-surface-overlay);
	}

	.shift-pill {
		display: flex;
	}

	.user-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.user-name {
		font-weight: 600;
		font-size: 14px;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Mobile bottom nav ───────────────────────────────────── */
	.bottom-nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		display: flex;
		align-items: stretch;
		background: var(--color-surface-raised);
		border-top: 1px solid var(--color-surface-overlay);
		font-family: var(--font-sans);
	}

	.bottom-item {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 56px;
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
		cursor: pointer;
		transition: all 150ms ease;
	}

	.bottom-item:active {
		transform: scale(0.95);
	}

	.bottom-item.active {
		color: var(--color-accent);
	}

	.bottom-icon {
		font-size: 20px;
		line-height: 1;
	}

	.bottom-label {
		font-size: 11px;
		font-weight: 600;
	}

	/* ── "Más" sheet links ───────────────────────────────────── */
	.sheet-link {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 0 12px;
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		font-weight: 600;
		font-size: 15px;
		text-align: left;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.sheet-link:active {
		transform: scale(0.98);
	}

	.sheet-link.active {
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		color: var(--color-accent);
	}

	.sheet-user {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		margin-top: 4px;
		border-top: 1px solid var(--color-surface-overlay);
	}
</style>
