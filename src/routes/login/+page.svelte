<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { signIn } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { t } from '$lib/i18n';

	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let hasError = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		hasError = false;
		try {
			await signIn(email, password);
			await goto(resolve('/pos'));
		} catch {
			hasError = true;
			toast.error(t('toasts.loginFailed'));
		} finally {
			submitting = false;
		}
	}
</script>

<div class="login-page">
	<div class="login-card">
		<img class="logo" src="/bulldog-logo.png" alt="Bulldog Hotdog" />
		<h1 class="title">{t('app.name')}</h1>
		<p class="subtitle">{t('login.subtitle')}</p>

		<form class="form" onsubmit={handleSubmit}>
			{#if hasError}
				<div class="error-banner" role="alert">
					{t('login.invalidCredentials')}
				</div>
			{/if}

			<Input
				label={t('login.email')}
				type="email"
				inputmode="email"
				placeholder={t('login.emailPlaceholder')}
				bind:value={email}
			/>
			<Input
				label={t('login.password')}
				type="password"
				placeholder={t('login.passwordPlaceholder')}
				bind:value={password}
			/>

			<Button type="submit" size="lg" full loading={submitting}>
				{submitting ? t('login.submitting') : t('login.submit')}
			</Button>
		</form>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 20px;
		background: var(--color-bg);
		font-family: var(--font-sans);
	}

	.login-card {
		width: calc(100% - 40px);
		max-width: 420px;
		padding: 36px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: 20px;
		text-align: center;
	}

	.logo {
		width: 120px;
		height: auto;
		margin: 0 auto 24px;
		display: block;
		border-radius: 16px;
	}

	.title {
		font-size: 26px;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: var(--color-text);
	}

	.subtitle {
		margin-top: 6px;
		margin-bottom: 28px;
		font-size: 13px;
		color: var(--color-text-faint);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 18px;
		text-align: left;
	}

	.error-banner {
		padding: 12px;
		border-radius: 11px;
		background: color-mix(in srgb, var(--color-red) 12%, transparent);
		border-left: 3px solid var(--color-red);
		color: var(--color-red);
		font-size: 14px;
		font-weight: 600;
	}
</style>
