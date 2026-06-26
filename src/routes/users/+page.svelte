<script lang="ts">
	import { usersDb } from '$lib/db';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { t } from '$lib/i18n';
	import type { Profile } from '$lib/types';
	import Modal from '$lib/components/Modal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';
	import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';

	let users = $state<Profile[]>([]);
	let loading = $state(true);

	let showCreate = $state(false);
	let showReset = $state(false);
	let resetTarget = $state<Profile | null>(null);
	let showDeactivateConfirm = $state(false);
	let deactivateTarget = $state<Profile | null>(null);

	let newFullName = $state('');
	let newUsername = $state('');
	let newPassword = $state('');
	let usernameError = $state<string | null>(null);
	let creating = $state(false);

	let resetPwd = $state('');
	let resetting = $state(false);

	const currentUserId = $derived(authStore.profile?.id ?? '');

	function getInitials(name: string): string {
		const parts = name.trim().split(/\s+/);
		if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	}

	function validateUsername(u: string): string | null {
		if (u.length < 3) return t('users.usernameMin');
		if (u.length > 20) return t('users.usernameMax');
		if (!/^[a-z0-9_]+$/.test(u)) return t('users.usernameHint');
		return null;
	}

	function onUsernameInput() {
		newUsername = newUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
		usernameError = newUsername ? validateUsername(newUsername) : null;
	}

	async function loadUsers() {
		try {
			users = await usersDb.list();
		} catch {
			toast.error(t('toasts.loadFailed'));
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		newFullName = '';
		newUsername = '';
		newPassword = '';
		usernameError = null;
		showCreate = true;
	}

	async function handleCreate() {
		usernameError = validateUsername(newUsername);
		if (usernameError || !newFullName.trim() || newPassword.length < 6) return;
		creating = true;
		try {
			await usersDb.create({
				full_name: newFullName.trim(),
				username: newUsername,
				password: newPassword
			});
			toast.success(t('users.created'));
			showCreate = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : t('toasts.saveFailed'));
		} finally {
			creating = false;
			await loadUsers();
		}
	}

	async function handleDeactivate() {
		if (!deactivateTarget) return;
		const id = deactivateTarget.id;
		deactivateTarget = null;
		try {
			await usersDb.deactivate(id);
			toast.success(t('users.deactivated'));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : t('toasts.saveFailed'));
		} finally {
			await loadUsers();
		}
	}

	async function handleReactivate(userId: string) {
		try {
			await usersDb.reactivate(userId);
			toast.success(t('users.reactivated'));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : t('toasts.saveFailed'));
		} finally {
			await loadUsers();
		}
	}

	async function handleResetPassword() {
		if (!resetTarget || resetPwd.length < 6) return;
		resetting = true;
		try {
			await usersDb.resetPassword(resetTarget.id, resetPwd);
			toast.success(t('users.passwordReset'));
			showReset = false;
			resetTarget = null;
			resetPwd = '';
		} catch (e) {
			toast.error(e instanceof Error ? e.message : t('toasts.saveFailed'));
		} finally {
			resetting = false;
		}
	}

	function openReset(user: Profile) {
		resetTarget = user;
		resetPwd = '';
		showReset = true;
	}

	$effect(() => {
		void loadUsers();
	});
</script>

<div class="page">
	<div class="page-actions">
		<Button icon="user-plus" onclick={openCreate}>
			{t('users.newWorker')}
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<LoadingSpinner size="lg" />
		</div>
	{:else}
		<div class="user-list">
			{#each users as user (user.id)}
				{@const isSelf = user.id === currentUserId}
				{@const isOwnerRole = user.role === 'owner'}
				<div class="user-card" class:inactive={!user.is_active}>
					<div
						class="avatar"
						class:avatar-owner={isOwnerRole}
						class:avatar-inactive={!user.is_active}
					>
						{getInitials(user.full_name)}
					</div>

					<div class="user-info">
						<div class="user-name-row">
							<span class="user-name">{user.full_name}</span>
							{#if isSelf}
								<span class="badge-you">{t('users.you')}</span>
							{/if}
							<span class="role-badge" class:role-owner={isOwnerRole}>
								{isOwnerRole ? t('users.roleOwner') : t('users.roleWorker')}
							</span>
						</div>
						<div class="user-meta">
							{#if user.username}
								<span class="username">@{user.username}</span>
								<span class="sep">·</span>
							{/if}
							<span class:status-inactive={!user.is_active}>
								{user.is_active ? t('users.active') : t('users.inactive')}
							</span>
						</div>
					</div>

					<div class="user-actions">
						{#if isSelf}
							<Button variant="secondary" size="sm" onclick={() => openReset(user)}>
								{t('users.changeMyPassword')}
							</Button>
						{:else if user.is_active}
							<Button variant="secondary" size="sm" onclick={() => openReset(user)}>
								{t('users.resetPassword')}
							</Button>
							<Button
								variant="danger"
								size="sm"
								onclick={() => {
									deactivateTarget = user;
									showDeactivateConfirm = true;
								}}
							>
								{t('users.deactivate')}
							</Button>
						{:else}
							<Button variant="secondary" size="sm" onclick={() => handleReactivate(user.id)}>
								{t('users.reactivate')}
							</Button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create worker modal -->
<Modal
	bind:open={showCreate}
	title={t('users.newWorker')}
	onclose={() => {
		usernameError = null;
	}}
>
	<div class="form-stack">
		<Input
			label={t('users.fullName')}
			bind:value={newFullName}
			placeholder="María González"
			autocomplete={null}
		/>
		<Input
			label={t('users.username')}
			bind:value={newUsername}
			placeholder="maria"
			helper={usernameError ? undefined : t('users.usernameHint')}
			error={usernameError ?? undefined}
			autocomplete={null}
			oninput={onUsernameInput}
		/>
		<Input
			label={t('users.tempPassword')}
			type="password"
			bind:value={newPassword}
			helper={t('users.passwordHint')}
			autocomplete={null}
		/>
		<div class="form-actions">
			<Button variant="secondary" onclick={() => (showCreate = false)}>
				{t('common.cancel')}
			</Button>
			<Button
				onclick={handleCreate}
				loading={creating}
				disabled={!newFullName.trim() || !newUsername || newPassword.length < 6}
			>
				{t('users.createWorker')}
			</Button>
		</div>
	</div>
</Modal>

<!-- Reset password modal -->
<Modal
	bind:open={showReset}
	title={t('users.resetPassword')}
	onclose={() => {
		resetTarget = null;
		resetPwd = '';
	}}
>
	{#if resetTarget}
		<div class="form-stack">
			<p class="reset-who">
				{resetTarget.full_name}{resetTarget.username ? ` (@${resetTarget.username})` : ''}
			</p>
			<Input
				label={t('users.newPassword')}
				type="password"
				bind:value={resetPwd}
				helper={t('users.passwordHint')}
				autocomplete={null}
			/>
			<div class="form-actions">
				<Button variant="secondary" onclick={() => (showReset = false)}>
					{t('common.cancel')}
				</Button>
				<Button onclick={handleResetPassword} loading={resetting} disabled={resetPwd.length < 6}>
					{t('users.resetBtn')}
				</Button>
			</div>
		</div>
	{/if}
</Modal>

<!-- Deactivate confirm -->
<ConfirmDialog
	bind:open={showDeactivateConfirm}
	message={t('users.deactivateConfirm').replace('{name}', deactivateTarget?.full_name ?? '')}
	danger
	onconfirm={handleDeactivate}
	oncancel={() => {
		deactivateTarget = null;
	}}
/>

<style>
	.page {
		padding: 20px;
		max-width: 680px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.page-actions {
		display: flex;
		justify-content: flex-end;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.user-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-card);
		transition: opacity 200ms ease;
	}

	.user-card.inactive {
		opacity: 0.6;
	}

	.avatar {
		flex: none;
		width: 44px;
		height: 44px;
		border-radius: var(--radius-full);
		background: var(--color-surface-2);
		color: var(--color-text-dim);
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 15px;
		font-family: var(--font-sans);
		letter-spacing: -0.02em;
		border: 1px solid var(--color-line);
	}

	.avatar-owner {
		background: color-mix(in srgb, var(--color-mustard) 18%, transparent);
		color: var(--color-mustard);
		border-color: color-mix(in srgb, var(--color-mustard) 30%, transparent);
	}

	.avatar-inactive {
		opacity: 0.5;
	}

	.user-info {
		flex: 1;
		min-width: 0;
	}

	.user-name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}

	.user-name {
		font-weight: 700;
		font-size: 15px;
		color: var(--color-text-primary);
	}

	.badge-you {
		font-size: 11px;
		font-weight: 700;
		padding: 2px 7px;
		border-radius: 20px;
		background: color-mix(in srgb, var(--color-mustard) 15%, transparent);
		color: var(--color-mustard);
	}

	.role-badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 20px;
		background: var(--color-surface-2);
		color: var(--color-text-dim);
		border: 1px solid var(--color-line);
	}

	.role-badge.role-owner {
		background: color-mix(in srgb, var(--color-mustard) 12%, transparent);
		color: color-mix(in srgb, var(--color-mustard) 90%, var(--color-text));
		border-color: color-mix(in srgb, var(--color-mustard) 25%, transparent);
	}

	.user-meta {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 3px;
		font-size: 13px;
		color: var(--color-text-faint);
	}

	.sep {
		color: var(--color-text-faint);
		opacity: 0.5;
	}

	.status-inactive {
		color: var(--color-text-faint);
		font-style: italic;
	}

	.user-actions {
		display: flex;
		gap: 8px;
		align-items: center;
		flex: none;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.form-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		padding-top: 4px;
	}

	.reset-who {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-dim);
		margin: 0;
	}

	@media (max-width: 600px) {
		.user-card {
			flex-wrap: wrap;
		}

		.user-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
