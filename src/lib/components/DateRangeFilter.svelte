<script lang="ts">
	import { SvelteDate } from 'svelte/reactivity';
	import {
		rangeFromPreset,
		rangeLabel,
		type DateRange,
		type DateRangePreset
	} from '$lib/utils/dateRange';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		value: DateRange;
		onChange: (range: DateRange) => void;
	}

	let { value, onChange }: Props = $props();
	let open = $state(false);
	let customFrom = $state('');
	let customTo = $state('');
	let triggerEl: HTMLButtonElement | null = $state(null);
	let menuAnchor: 'left' | 'right' = $state('right');

	const presets: { key: DateRangePreset; label: string }[] = [
		{ key: 'today', label: t('dateRange.today') },
		{ key: 'yesterday', label: t('dateRange.yesterday') },
		{ key: 'week', label: t('dateRange.week') },
		{ key: 'month', label: t('dateRange.month') },
		{ key: 'all', label: t('dateRange.all') }
	];

	function pickPreset(preset: DateRangePreset) {
		onChange(rangeFromPreset(preset));
		open = false;
	}

	function applyCustom() {
		if (!customFrom || !customTo) return;
		const from = new SvelteDate(customFrom);
		from.setHours(0, 0, 0, 0);
		const to = new SvelteDate(customTo);
		to.setHours(23, 59, 59, 999);
		onChange({ preset: 'custom', from, to });
		open = false;
	}

	function toggle() {
		if (!open && triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			menuAnchor = window.innerWidth - rect.left >= 276 ? 'left' : 'right';
		}
		open = !open;
		if (open && value.from) {
			customFrom = value.from.toISOString().slice(0, 10);
			customTo = value.to ? value.to.toISOString().slice(0, 10) : customFrom;
		}
	}
</script>

<div class="daterange">
	<button bind:this={triggerEl} class="daterange__trigger" onclick={toggle}>
		<Icon name="calendar" size={15} />
		<span>{rangeLabel(value)}</span>
		<Icon name="chevronDown" size={13} />
	</button>

	{#if open}
		<div class="daterange__backdrop" onclick={() => (open = false)} role="presentation"></div>
		<div
			class="daterange__menu"
			style={menuAnchor === 'left' ? 'left: 0; right: auto;' : 'right: 0; left: auto;'}
		>
			<div class="daterange__presets">
				{#each presets as p (p.key)}
					<button
						class="daterange__preset"
						class:daterange__preset--active={value.preset === p.key}
						onclick={() => pickPreset(p.key)}
					>
						{p.label}
					</button>
				{/each}
			</div>

			<div class="daterange__divider"></div>

			<div class="daterange__custom">
				<p class="daterange__custom-label">{t('dateRange.custom')}</p>
				<div class="daterange__inputs">
					<input
						type="date"
						bind:value={customFrom}
						class="daterange__date"
						aria-label="Fecha desde"
					/>
					<span class="daterange__sep">–</span>
					<input
						type="date"
						bind:value={customTo}
						class="daterange__date"
						aria-label="Fecha hasta"
					/>
				</div>
				<button class="daterange__apply" onclick={applyCustom} disabled={!customFrom || !customTo}>
					{t('dateRange.apply')}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.daterange {
		position: relative;
	}

	.daterange__trigger {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 9px 12px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		border-radius: 11px;
		color: var(--color-text);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		min-height: 40px;
		white-space: nowrap;
		transition: border-color 0.15s;
	}
	.daterange__trigger:hover {
		border-color: var(--color-mustard);
	}

	.daterange__backdrop {
		position: fixed;
		inset: 0;
		z-index: 44;
	}

	.daterange__menu {
		position: absolute;
		top: calc(100% + 6px);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--r-card);
		box-shadow: 0 18px 44px -14px rgba(0, 0, 0, 0.7);
		z-index: 45;
		width: min(260px, calc(100vw - 32px));
		padding: 10px;
	}

	.daterange__presets {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.daterange__preset {
		padding: 9px 10px;
		background: none;
		border: none;
		border-radius: 8px;
		color: var(--color-text-dim);
		font-size: 13.5px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		min-height: 40px;
		transition: background 0.12s;
	}
	.daterange__preset:hover {
		background: var(--color-surface-2);
	}
	.daterange__preset--active {
		background: var(--color-mustard-soft);
		color: var(--color-mustard);
	}

	.daterange__divider {
		height: 1px;
		background: var(--color-line);
		margin: 8px 0;
	}

	.daterange__custom-label {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-text-faint);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 8px 2px;
	}

	.daterange__inputs {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		flex-wrap: nowrap;
	}

	.daterange__date {
		flex: 1 1 0;
		min-width: 0;
		background: var(--color-surface-2);
		border: 1px solid var(--color-line-2);
		border-radius: 8px;
		padding: 8px 6px;
		color: var(--color-text);
		font-size: 12px;
		width: 100%;
	}

	.daterange__sep {
		color: var(--color-text-faint);
		font-size: 12px;
	}

	.daterange__apply {
		width: 100%;
		padding: 10px;
		background: var(--color-mustard);
		color: #000;
		border: none;
		border-radius: 9px;
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		min-height: 40px;
		transition: filter 0.12s;
	}
	.daterange__apply:hover:not(:disabled) {
		filter: brightness(1.06);
	}
	.daterange__apply:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 400px) {
		.daterange__inputs {
			flex-direction: column;
			gap: 8px;
		}
		.daterange__sep {
			display: none;
		}
		.daterange__date {
			width: 100%;
		}
	}
</style>
