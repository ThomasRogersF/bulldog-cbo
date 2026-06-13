// Reactive auth state. Read authStore.user / authStore.profile in components.
import { auth, profilesDb } from '$lib/db';
import type { AuthUser, Profile } from '$lib/types';

export const authStore = $state({
	ready: false,
	user: null as AuthUser | null,
	profile: null as Profile | null
});

let unsub: (() => void) | null = null;

export async function initAuth(): Promise<void> {
	const session = await auth.getSession();
	authStore.user = session?.user ?? null;
	if (authStore.user) {
		try {
			const profile = await profilesDb.getCurrent();
			authStore.profile = profile;
		} catch {
			authStore.profile = null;
		}
	}
	if (!unsub) {
		unsub = auth.onAuthStateChange((user) => {
			const prevId = authStore.user?.id;
			authStore.user = user;
			if (!user) {
				authStore.profile = null;
			} else if (user.id !== prevId) {
				profilesDb
					.getCurrent()
					.then((profile) => {
						authStore.profile = profile;
					})
					.catch(() => {});
			}
		}).unsubscribe;
	}
	authStore.ready = true;
}

export async function signIn(username: string, password: string): Promise<void> {
	await auth.signIn(username, password);
	const session = await auth.getSession();
	authStore.user = session?.user ?? null;
	const profile = authStore.user ? await profilesDb.getCurrent() : null;
	authStore.profile = profile;
}

export async function signOut(): Promise<void> {
	await auth.signOut();
	authStore.user = null;
	authStore.profile = null;
}

export function isOwner(): boolean {
	return authStore.profile?.role === 'owner';
}
