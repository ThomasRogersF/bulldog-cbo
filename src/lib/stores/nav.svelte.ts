// Navigation model — single source for sidebar + bottom nav, filtered by role.
import type { Role } from '$lib/types';

export interface NavItem {
	href: string;
	labelKey: string;
	icon: string;
	roles: Role[];
	/** Shown directly in the mobile bottom bar (vs the "Más" sheet). */
	primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
	{ href: '/dashboard', labelKey: 'nav.dashboard', icon: '🏠', roles: ['owner'], primary: true },
	{ href: '/pos', labelKey: 'nav.pos', icon: '🛒', roles: ['owner', 'worker'], primary: true },
	{
		href: '/orders',
		labelKey: 'nav.orders',
		icon: '📋',
		roles: ['owner', 'worker'],
		primary: true
	},
	{
		href: '/ingredients',
		labelKey: 'nav.ingredients',
		icon: '📦',
		roles: ['owner'],
		primary: true
	},
	{ href: '/menu', labelKey: 'nav.menu', icon: '🍽️', roles: ['owner'], primary: false },
	{
		href: '/customers',
		labelKey: 'nav.customers',
		icon: '👥',
		roles: ['owner', 'worker'],
		primary: false
	},
	{
		href: '/shifts',
		labelKey: 'nav.shifts',
		icon: '🕐',
		roles: ['owner', 'worker'],
		primary: false
	},
	{ href: '/settings', labelKey: 'nav.settings', icon: '⚙️', roles: ['owner'], primary: false }
];

export const navStore = $state({ mobileMenuOpen: false });

export function visibleNav(role: Role | null | undefined): NavItem[] {
	if (!role) return [];
	return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function toggleMobileMenu(open?: boolean): void {
	navStore.mobileMenuOpen = open ?? !navStore.mobileMenuOpen;
}
