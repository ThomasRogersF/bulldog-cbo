// PWA install state. The <InstallPrompt /> banner reads installStore and offers
// a one-tap install on Chromium (beforeinstallprompt) or "add to home screen"
// steps on iOS Safari (which has no install API). Listeners are attached via
// initInstall() — called early from +layout.svelte so a beforeinstallprompt that
// fires before the banner mounts is captured, not lost.

const DISMISS_KEY = 'bulldog-install-dismissed';

// Chromium's deferred install prompt — not in the standard DOM lib.
interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
		appinstalled: Event;
	}
}

export type InstallPlatform = 'installable' | 'ios' | 'none';

// Held outside $state — it is an opaque event handle, never rendered.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;

export const installStore = $state({
	platform: 'none' as InstallPlatform,
	visible: false
});

function isStandalone(): boolean {
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		// iOS Safari reports standalone via this non-standard navigator flag.
		(navigator as unknown as { standalone?: boolean }).standalone === true
	);
}

function isIos(): boolean {
	return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Show once per session unless the user dismissed it this session.
function maybeShow(): void {
	if (installStore.platform === 'none') return;
	let dismissed = false;
	try {
		dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
	} catch {
		// sessionStorage can be unavailable (private mode) — treat as not dismissed.
	}
	if (!dismissed) installStore.visible = true;
}

// Idempotent — safe to call from both the layout bootstrap and the component.
export function initInstall(): void {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;

	// Already running as an installed app — nothing to prompt.
	if (isStandalone()) return;

	window.addEventListener('beforeinstallprompt', (e) => {
		// Keep the event so we can trigger the prompt from our own UI later.
		e.preventDefault();
		deferredPrompt = e;
		installStore.platform = 'installable';
		maybeShow();
	});

	window.addEventListener('appinstalled', () => {
		deferredPrompt = null;
		installStore.platform = 'none';
		installStore.visible = false;
	});

	// iOS has no beforeinstallprompt — detect it so we can show manual steps.
	if (isIos()) {
		installStore.platform = 'ios';
		maybeShow();
	}
}

export async function triggerInstall(): Promise<void> {
	if (!deferredPrompt) return;
	try {
		await deferredPrompt.prompt();
		await deferredPrompt.userChoice;
	} catch {
		// prompt() rejects if already consumed (e.g. a double-tap) — fall through.
	} finally {
		// The deferred prompt can only be used once; appinstalled handles success.
		deferredPrompt = null;
		installStore.visible = false;
	}
}

export function dismissInstall(): void {
	installStore.visible = false;
	try {
		sessionStorage.setItem(DISMISS_KEY, '1');
	} catch {
		// Storage can throw in private mode — dismissal just won't persist.
	}
}

// Re-show the banner from Settings → "Cómo instalar", ignoring the per-session
// dismissal. No-op when there is nothing actionable: already installed/unsupported,
// or the native prompt was already used this session (Chromium won't re-fire it,
// which would otherwise render a dead "Instalar" button).
export function showInstall(): void {
	if (installStore.platform === 'none') return;
	if (installStore.platform === 'installable' && !deferredPrompt) return;
	installStore.visible = true;
}
