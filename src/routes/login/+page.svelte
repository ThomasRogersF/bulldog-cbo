<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { signIn } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { t } from '$lib/i18n';

	import Card from '$lib/components/Card.svelte';
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
	<div class="login-box">
		<Card elevation={2} padding="lg">
			<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
				<div class="text-center">
					<div class="wordmark">
						<span aria-hidden="true">🌭</span> Bulldog CBO
					</div>
					<p class="subtitle">{t('login.subtitle')}</p>
				</div>

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
		</Card>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 24px;
		background: var(--color-surface-base);
		font-family: var(--font-sans);
	}

	.login-box {
		width: 100%;
		max-width: 380px;
	}

	.wordmark {
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 32px;
		line-height: 1.1;
		color: var(--color-accent);
	}

	.subtitle {
		margin-top: 8px;
		font-size: 14px;
		color: var(--color-text-muted);
	}

	.error-banner {
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: var(--color-danger);
		color: var(--color-danger-fg);
		font-size: 14px;
		font-weight: 600;
		text-align: center;
	}
</style>
