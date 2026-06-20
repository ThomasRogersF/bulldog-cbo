<script lang="ts">
	import { exportCSV, exportExcel, exportPDF, type ExportOptions } from '$lib/utils/export';
	import { t } from '$lib/i18n';
	import { toast } from '$lib/stores/toast.svelte';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		getExportOptions: () => ExportOptions;
		disabled?: boolean;
	}

	let { getExportOptions, disabled = false }: Props = $props();
	let open = $state(false);
	let exporting = $state(false);

	function handleExport(format: 'csv' | 'excel' | 'pdf') {
		if (exporting) return;
		exporting = true;
		open = false;

		try {
			const opts = getExportOptions();
			if (opts.rows.length === 0) {
				toast.warning(t('export.noData'));
				return;
			}

			if (format === 'csv') exportCSV(opts);
			else if (format === 'excel') exportExcel(opts);
			else exportPDF(opts);

			toast.success(t('export.success'));
		} catch (err) {
			toast.error(t('export.error'));
			console.error('Export failed:', err);
		} finally {
			exporting = false;
		}
	}

	function toggleOpen() {
		if (!disabled) open = !open;
	}
</script>

<div class="export-btn">
	<button class="export-btn__trigger" onclick={toggleOpen} disabled={disabled || exporting}>
		<Icon name="download" size={15} />
		<span class="export-btn__label">{t('export.button')}</span>
	</button>

	{#if open}
		<div class="export-btn__backdrop" onclick={() => (open = false)} role="presentation"></div>
		<div class="export-btn__menu">
			<button class="export-btn__item" onclick={() => handleExport('csv')}>
				<Icon name="file-text" size={15} />
				<span>
					<strong>CSV</strong>
					<small>{t('export.csvHint')}</small>
				</span>
			</button>
			<button class="export-btn__item" onclick={() => handleExport('excel')}>
				<Icon name="table" size={15} />
				<span>
					<strong>Excel</strong>
					<small>{t('export.excelHint')}</small>
				</span>
			</button>
			<button class="export-btn__item" onclick={() => handleExport('pdf')}>
				<Icon name="file" size={15} />
				<span>
					<strong>PDF</strong>
					<small>{t('export.pdfHint')}</small>
				</span>
			</button>
		</div>
	{/if}
</div>

<style>
	.export-btn {
		position: relative;
	}

	.export-btn__trigger {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 9px 14px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		border-radius: 11px;
		color: var(--color-text-dim);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		min-height: 40px;
		transition:
			border-color 0.15s,
			color 0.15s;
	}
	.export-btn__trigger:hover:not(:disabled) {
		border-color: var(--color-mustard);
		color: var(--color-text);
	}
	.export-btn__trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.export-btn__backdrop {
		position: fixed;
		inset: 0;
		z-index: 44;
	}

	.export-btn__menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-card);
		box-shadow: 0 18px 44px -14px rgba(0, 0, 0, 0.7);
		z-index: 45;
		min-width: 220px;
		padding: 6px;
	}

	.export-btn__item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 11px;
		background: none;
		border: none;
		border-radius: 9px;
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		min-height: 48px;
		transition: background 0.12s;
	}
	.export-btn__item:hover {
		background: var(--color-surface-2);
	}
	.export-btn__item strong {
		display: block;
		font-size: 13.5px;
		font-weight: 700;
	}
	.export-btn__item small {
		display: block;
		font-size: 11px;
		color: var(--color-text-faint);
		font-weight: 400;
	}

	@media (max-width: 480px) {
		.export-btn__label {
			display: none;
		}
	}
</style>
