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
</script>

<div class="flex flex-col gap-1.5 w-full">
	{#if label}
		<label class="field-label" for={id}>{label}</label>
	{/if}
	<input
		{id}
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
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
	}

	.field-input {
		min-height: 48px;
		padding: 12px;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		font-size: 16px;
		transition: border-color 150ms ease;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.field-input.has-error {
		border-color: var(--color-danger);
	}

	.field-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.field-input::placeholder {
		color: var(--color-text-muted);
	}

	.field-error {
		font-size: 12px;
		color: var(--color-danger);
		font-family: var(--font-sans);
	}

	.field-helper {
		font-size: 12px;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}
</style>
