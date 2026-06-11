<script lang="ts">
	let {
		label,
		value = $bindable(''),
		type = 'text',
		placeholder,
		error,
		helper,
		disabled = false,
		inputmode,
		id,
		oninput
	}: {
		label?: string;
		value?: string;
		type?: string;
		placeholder?: string;
		error?: string;
		helper?: string;
		disabled?: boolean;
		inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
		id?: string;
		oninput?: (e: Event) => void;
	} = $props();

	// Inputs must always have an id so the label is associated (a11y + testability).
	const uid = $props.id();
	const inputId = $derived(id ?? uid);
</script>

<div class="flex flex-col gap-1.5 w-full">
	{#if label}
		<label class="field-label" for={inputId}>{label}</label>
	{/if}
	<input
		id={inputId}
		{type}
		{placeholder}
		{disabled}
		{inputmode}
		bind:value
		{oninput}
		class="field-input w-full"
		class:has-error={!!error}
		aria-invalid={error ? 'true' : undefined}
	/>
	{#if error}
		<span class="field-error">{error}</span>
	{:else if helper}
		<span class="field-helper">{helper}</span>
	{/if}
</div>

<style>
	.field-label {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-family: var(--font-sans);
	}

	.field-input {
		min-height: 48px;
		padding: 12px 14px;
		border: 1px solid var(--color-line-2);
		border-radius: 11px;
		background: var(--color-surface-2);
		color: var(--color-text);
		font-family: var(--font-sans);
		font-size: 15px;
		transition: border-color 150ms ease;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-mustard);
	}

	.field-input.has-error {
		border-color: var(--color-red);
	}

	.field-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.field-input::placeholder {
		color: var(--color-text-faint);
	}

	.field-error {
		font-size: 12px;
		color: var(--color-red);
		font-family: var(--font-sans);
	}

	.field-helper {
		font-size: 12px;
		color: var(--color-text-faint);
		font-family: var(--font-sans);
	}
</style>
