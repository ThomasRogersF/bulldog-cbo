<script lang="ts">
	import { settingsDb, notificationsDb } from '$lib/db';
	import { toast } from '$lib/stores/toast.svelte';
	import { showInstall } from '$lib/stores/install.svelte';
	import { t } from '$lib/i18n';
	import { APP_VERSION } from '$lib/version';
	import { formatDateTime } from '$lib/utils/format';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
	import Icon from '$lib/components/Icon.svelte';

	type AlertKey = 'low_stock_alerts' | 'shift_alerts' | 'large_sale_alerts' | 'override_alerts';

	let loading = $state(true);

	// Exchange rate
	let usdRate = $state('');
	let usdRateUpdatedAt = $state<string | null>(null);
	let savingRate = $state(false);

	// Telegram
	let telegramBotToken = $state('');
	let telegramChatId = $state('');
	let savingBotToken = $state(false);
	let savingChatId = $state(false);
	let testing = $state(false);

	// Alerts
	let alerts = $state<Record<AlertKey, boolean>>({
		low_stock_alerts: false,
		shift_alerts: false,
		large_sale_alerts: false,
		override_alerts: false
	});

	// Large sale threshold
	let largeSaleThreshold = $state('');
	let savingThreshold = $state(false);

	// Business
	let businessName = $state('');
	let businessPhone = $state('');
	let savingBusinessName = $state(false);
	let savingBusinessPhone = $state(false);

	// Theme
	let isDark = $state(false);

	const alertItems: { key: AlertKey; label: string }[] = [
		{ key: 'low_stock_alerts', label: 'lowStockAlerts' },
		{ key: 'shift_alerts', label: 'shiftAlerts' },
		{ key: 'large_sale_alerts', label: 'largeSaleAlerts' },
		{ key: 'override_alerts', label: 'overrideAlerts' }
	];

	$effect(() => {
		void load();
	});

	$effect(() => {
		// Dark is the default; only an explicit 'light' preference opts out.
		const stored = localStorage.getItem('theme');
		const dark = stored !== 'light';
		isDark = dark;
		document.documentElement.dataset.theme = dark ? 'dark' : 'light';
	});

	async function load(): Promise<void> {
		loading = true;
		try {
			const s = await settingsDb.getAll();
			usdRate = s.usd_rate ?? '';
			usdRateUpdatedAt = s.usd_rate_updated_at ?? null;
			telegramBotToken = s.telegram_bot_token ?? '';
			telegramChatId = s.telegram_chat_id ?? '';
			alerts = {
				low_stock_alerts: s.low_stock_alerts === 'true',
				shift_alerts: s.shift_alerts === 'true',
				large_sale_alerts: s.large_sale_alerts === 'true',
				override_alerts: s.override_alerts === 'true'
			};
			largeSaleThreshold = s.large_sale_threshold ?? '';
			businessName = s.business_name ?? '';
			businessPhone = s.business_phone ?? '';
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loading = false;
		}
	}

	async function saveSetting(key: string, value: string): Promise<boolean> {
		try {
			await settingsDb.set(key, value);
			return true;
		} catch {
			toast.error(t('toasts.saveFailed'));
			return false;
		}
	}

	async function saveRate(): Promise<void> {
		savingRate = true;
		try {
			const okValue = await saveSetting('usd_rate', usdRate);
			if (!okValue) return;
			const iso = new Date().toISOString();
			const okStamp = await saveSetting('usd_rate_updated_at', iso);
			if (!okStamp) return;
			usdRateUpdatedAt = iso;
			toast.success(t('toasts.rateUpdated'));
		} finally {
			savingRate = false;
		}
	}

	async function saveBotToken(): Promise<void> {
		savingBotToken = true;
		try {
			if (await saveSetting('telegram_bot_token', telegramBotToken)) {
				toast.success(t('toasts.saved'));
			}
		} finally {
			savingBotToken = false;
		}
	}

	async function saveChatId(): Promise<void> {
		savingChatId = true;
		try {
			if (await saveSetting('telegram_chat_id', telegramChatId)) {
				toast.success(t('toasts.saved'));
			}
		} finally {
			savingChatId = false;
		}
	}

	async function sendTestMessage(): Promise<void> {
		if (!telegramBotToken || !telegramChatId) {
			toast.error(t('toasts.telegramNotConfigured'));
			return;
		}
		testing = true;
		try {
			await notificationsDb.test();
			toast.success(t('toasts.testSent'));
		} catch {
			toast.error(t('toasts.testFailed'));
		} finally {
			testing = false;
		}
	}

	async function toggleAlert(key: AlertKey): Promise<void> {
		const next = !alerts[key];
		alerts[key] = next;
		if (await saveSetting(key, next ? 'true' : 'false')) {
			toast.success(t('toasts.saved'));
		} else {
			alerts[key] = !next;
		}
	}

	async function saveThreshold(): Promise<void> {
		savingThreshold = true;
		try {
			if (await saveSetting('large_sale_threshold', largeSaleThreshold)) {
				toast.success(t('toasts.saved'));
			}
		} finally {
			savingThreshold = false;
		}
	}

	async function saveBusinessName(): Promise<void> {
		savingBusinessName = true;
		try {
			if (await saveSetting('business_name', businessName)) {
				toast.success(t('toasts.saved'));
			}
		} finally {
			savingBusinessName = false;
		}
	}

	async function saveBusinessPhone(): Promise<void> {
		savingBusinessPhone = true;
		try {
			if (await saveSetting('business_phone', businessPhone)) {
				toast.success(t('toasts.saved'));
			}
		} finally {
			savingBusinessPhone = false;
		}
	}

	function toggleTheme(): void {
		const next = !isDark;
		isDark = next;
		const theme = next ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		localStorage.setItem('theme', theme);
		toast.success(t('toasts.saved'));
	}
</script>

<div class="page mx-auto w-full max-w-3xl px-4 pt-6 lg:pb-6">
	{#if loading}
		<div class="flex justify-center py-16">
			<LoadingSpinner size="lg" />
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<!-- Exchange rate -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="swap" size={18} /></span>
						<h2 class="section-title">{t('settings.exchangeRate')}</h2>
					</header>
					{#if usdRateUpdatedAt}
						<p class="section-meta">
							{t('settings.rateUpdated')}: {formatDateTime(usdRateUpdatedAt)}
						</p>
					{/if}
					<Input
						label={t('settings.usdRate')}
						type="number"
						inputmode="decimal"
						bind:value={usdRate}
					/>
					<div class="self-start">
						<Button onclick={saveRate} loading={savingRate}>
							{t('settings.updateRate')}
						</Button>
					</div>
				</div>
			</Card>

			<!-- Telegram -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="bell" size={18} /></span>
						<h2 class="section-title">{t('settings.telegram')}</h2>
					</header>

					<div class="flex flex-col gap-2">
						<Input label={t('settings.botToken')} bind:value={telegramBotToken} />
						<div class="self-start">
							<Button variant="secondary" size="sm" onclick={saveBotToken} loading={savingBotToken}>
								{t('common.save')}
							</Button>
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<Input label={t('settings.chatId')} inputmode="numeric" bind:value={telegramChatId} />
						<div class="self-start">
							<Button variant="secondary" size="sm" onclick={saveChatId} loading={savingChatId}>
								{t('common.save')}
							</Button>
						</div>
					</div>

					<div class="self-start">
						<Button variant="ghost" onclick={sendTestMessage} loading={testing}>
							{t('settings.testMessage')}
						</Button>
					</div>
				</div>
			</Card>

			<!-- Alerts -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="bell" size={18} /></span>
						<h2 class="section-title">{t('settings.alerts')}</h2>
					</header>
					<ul class="flex flex-col">
						{#each alertItems as item (item.key)}
							<li class="toggle-row">
								<span class="toggle-label">{t(`settings.${item.label}`)}</span>
								<button
									type="button"
									role="switch"
									aria-checked={alerts[item.key]}
									aria-label={t(`settings.${item.label}`)}
									class="switch"
									class:switch-on={alerts[item.key]}
									onclick={() => toggleAlert(item.key)}
								>
									<span class="switch-thumb"></span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</Card>

			<!-- Large sale threshold -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="cash" size={18} /></span>
						<h2 class="section-title">{t('settings.largeSaleThreshold')}</h2>
					</header>
					<Input type="number" inputmode="decimal" bind:value={largeSaleThreshold} />
					<div class="self-start">
						<Button onclick={saveThreshold} loading={savingThreshold}>
							{t('common.save')}
						</Button>
					</div>
				</div>
			</Card>

			<!-- Business -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="pin" size={18} /></span>
						<h2 class="section-title">{t('settings.business')}</h2>
					</header>

					<div class="flex flex-col gap-2">
						<Input label={t('settings.businessName')} bind:value={businessName} />
						<div class="self-start">
							<Button
								variant="secondary"
								size="sm"
								onclick={saveBusinessName}
								loading={savingBusinessName}
							>
								{t('common.save')}
							</Button>
						</div>
					</div>

					<div class="flex flex-col gap-2">
						<Input
							label={t('settings.businessPhone')}
							type="tel"
							inputmode="tel"
							bind:value={businessPhone}
						/>
						<div class="self-start">
							<Button
								variant="secondary"
								size="sm"
								onclick={saveBusinessPhone}
								loading={savingBusinessPhone}
							>
								{t('common.save')}
							</Button>
						</div>
					</div>
				</div>
			</Card>

			<!-- Theme -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="sparkle" size={18} /></span>
						<h2 class="section-title">{t('settings.theme')}</h2>
					</header>
					<div class="toggle-row">
						<span class="toggle-label">
							{isDark ? t('settings.themeDark') : t('settings.themeLight')}
						</span>
						<button
							type="button"
							role="switch"
							aria-checked={isDark}
							aria-label={t('settings.theme')}
							class="switch"
							class:switch-on={isDark}
							onclick={toggleTheme}
						>
							<span class="switch-thumb"></span>
						</button>
					</div>
				</div>
			</Card>

			<!-- Acerca de -->
			<Card>
				<div class="flex flex-col gap-4">
					<header class="section-header">
						<span class="section-icon"><Icon name="box" size={18} /></span>
						<h2 class="section-title">{t('settings.about')}</h2>
					</header>
					<p class="section-meta tabular-nums">{t('settings.version')} {APP_VERSION}</p>
					<div class="self-start">
						<Button variant="secondary" onclick={showInstall}>
							{t('settings.howToInstall')}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	{/if}
</div>

<style>
	.section-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.section-icon {
		display: grid;
		place-items: center;
		color: var(--color-mustard);
	}

	.section-title {
		font-family: var(--font-sans);
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-text);
	}

	.section-meta {
		font-family: var(--font-sans);
		font-size: 0.8125rem;
		color: var(--color-text-faint);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 48px;
	}

	.toggle-label {
		font-family: var(--font-sans);
		font-size: 1rem;
		color: var(--color-text);
	}

	.switch {
		position: relative;
		flex-shrink: 0;
		width: 52px;
		height: 30px;
		padding: 3px;
		border: none;
		border-radius: var(--radius-full);
		background-color: var(--color-surface-3);
		cursor: pointer;
		transition: background-color 150ms ease;
	}

	.switch:active {
		transform: scale(0.97);
	}

	.switch-on {
		background-color: var(--color-mustard);
	}

	.switch-thumb {
		display: block;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
		background-color: var(--color-text);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		transition: transform 150ms ease;
	}

	.switch-on .switch-thumb {
		transform: translateX(22px);
		background-color: var(--color-accent-fg);
	}
</style>
