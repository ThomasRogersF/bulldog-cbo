<script lang="ts">
	import { untrack } from 'svelte';
	import { compressImage, formatBytes } from '$lib/utils/image';
	import { storageDb } from '$lib/db';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		menuItemId: string;
		currentUrl?: string | null;
		onUploaded: (url: string) => void;
		onDeleted?: () => void;
	}

	let { menuItemId, currentUrl = null, onUploaded, onDeleted }: Props = $props();

	type Phase = 'idle' | 'compressing' | 'uploading' | 'done' | 'error';
	let phase = $state<Phase>('idle');
	let previewUrl = $state<string | null>(untrack(() => currentUrl) ?? null);
	let originalSize = $state(0);
	let compressedSize = $state(0);
	let errorMsg = $state('');
	let isDragging = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	const COMPRESS_OPTS = {
		maxWidth: 800,
		maxHeight: 800,
		quality: 0.82,
		format: 'image/webp' as const
	};

	async function handleFile(file: File) {
		if (!file.type.startsWith('image/')) {
			errorMsg = t('imageUpload.notImage');
			phase = 'error';
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			errorMsg = t('imageUpload.tooLarge');
			phase = 'error';
			return;
		}

		phase = 'compressing';
		errorMsg = '';

		try {
			const result = await compressImage(file, COMPRESS_OPTS);
			originalSize = result.originalSize;
			compressedSize = result.compressedSize;

			if (previewUrl && previewUrl !== currentUrl) {
				URL.revokeObjectURL(previewUrl);
			}
			previewUrl = URL.createObjectURL(result.blob);

			phase = 'uploading';
			const publicUrl = await storageDb.uploadMenuImage(menuItemId, result.blob, 'webp');

			previewUrl = publicUrl;
			phase = 'done';
			onUploaded(publicUrl);
		} catch (err) {
			phase = 'error';
			errorMsg = String(err);
		}
	}

	function onFileInput(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) handleFile(file);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	}

	async function removeImage() {
		if (!currentUrl) return;
		try {
			await storageDb.deleteMenuImage(currentUrl);
		} catch {
			// Non-fatal — just clear the UI
		}
		previewUrl = null;
		phase = 'idle';
		onDeleted?.();
	}

	const saving = $derived(phase === 'compressing' || phase === 'uploading');
	const compressionPct = $derived(
		originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0
	);
</script>

<div class="image-upload">
	{#if previewUrl}
		<div class="preview">
			<img src={previewUrl} alt="Preview" class="preview__img" />
			<div class="preview__actions">
				<button class="preview__change" onclick={() => inputEl?.click()} disabled={saving}>
					<Icon name="camera" size={14} />
					{t('imageUpload.change')}
				</button>
				<button class="preview__remove" onclick={removeImage} disabled={saving}>
					<Icon name="trash" size={14} />
				</button>
			</div>
			{#if phase === 'done' && compressionPct > 0}
				<div class="preview__stats">
					<span class="stat stat--green">
						↓{compressionPct}% · {formatBytes(originalSize)} → {formatBytes(compressedSize)}
					</span>
				</div>
			{/if}
		</div>
	{:else}
		<div
			class="dropzone"
			class:dropzone--active={isDragging}
			class:dropzone--error={phase === 'error'}
			role="button"
			tabindex="0"
			ondragover={(e) => {
				e.preventDefault();
				isDragging = true;
			}}
			ondragleave={() => {
				isDragging = false;
			}}
			ondrop={onDrop}
			onclick={() => inputEl?.click()}
			onkeydown={(e) => e.key === 'Enter' && inputEl?.click()}
		>
			<div class="dropzone__icon">
				<Icon name="camera" size={24} />
			</div>
			<p class="dropzone__label">{t('imageUpload.dropLabel')}</p>
			<p class="dropzone__hint">{t('imageUpload.hint')}</p>
		</div>
	{/if}

	{#if saving}
		<div class="upload-status">
			<div class="spinner spinner--sm"></div>
			<span>
				{phase === 'compressing' ? t('imageUpload.compressing') : t('imageUpload.uploading')}
			</span>
		</div>
	{/if}

	{#if phase === 'error'}
		<p class="upload-error">{errorMsg}</p>
	{/if}

	<input
		bind:this={inputEl}
		type="file"
		accept="image/jpeg,image/png,image/webp,image/heic"
		style="display:none"
		onchange={onFileInput}
	/>
</div>

<style>
	.image-upload {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.dropzone {
		border: 1.5px dashed var(--color-line-2);
		border-radius: var(--r-card);
		padding: 28px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
		background: var(--color-surface-2);
		text-align: center;
	}
	.dropzone:hover,
	.dropzone--active {
		border-color: var(--color-mustard);
		background: var(--color-mustard-soft);
	}
	.dropzone--error {
		border-color: var(--color-red);
	}
	.dropzone__icon {
		color: var(--color-text-dim);
		margin-bottom: 4px;
	}
	.dropzone__label {
		font-size: 13.5px;
		font-weight: 700;
		color: var(--color-text-dim);
	}
	.dropzone__hint {
		font-size: 11.5px;
		color: var(--color-text-faint);
	}

	.preview {
		position: relative;
	}
	.preview__img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--r-card);
		display: block;
	}
	.preview__actions {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 6px;
	}
	.preview__change {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 6px 10px;
		background: rgba(16, 15, 13, 0.75);
		backdrop-filter: blur(4px);
		border: 1px solid var(--color-line-2);
		border-radius: 8px;
		color: var(--color-text);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.preview__remove {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(16, 15, 13, 0.75);
		backdrop-filter: blur(4px);
		border: 1px solid var(--color-line-2);
		border-radius: 8px;
		color: var(--color-red);
		cursor: pointer;
	}
	.preview__stats {
		margin-top: 6px;
		text-align: center;
	}
	.stat--green {
		font-size: 11.5px;
		color: var(--color-green);
		font-weight: 600;
	}

	.upload-status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--color-text-dim);
	}
	.upload-error {
		font-size: 12.5px;
		color: var(--color-red);
		padding: 8px 12px;
		background: rgba(255, 82, 71, 0.1);
		border-radius: 8px;
	}
</style>
