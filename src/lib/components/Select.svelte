<script lang="ts">
	let {
		label,
		value = $bindable(''),
		options,
		placeholder,
		disabled = false,
		error
	}: {
		label?: string;
		value?: string;
		options: { value: string; label: string }[];
		placeholder?: string;
		disabled?: boolean;
		error?: string;
	} = $props();
</script>

<label class="flex flex-col gap-1.5 w-full">
	{#if label}
		<span class="field-label">{label}</span>
	{/if}
	<select
		{disabled}
		bind:value
		class="field-select w-full"
		class:has-error={!!error}
		aria-invalid={error ? 'true' : undefined}
	>
		{#if placeholder}
			<option value="" disabled>{placeholder}</option>
		{/if}
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if error}
		<span class="field-error">{error}</span>
	{/if}
</label>

<style>
	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
	}

	.field-select {
		min-height: 48px;
		padding: 12px;
		border: 1px solid var(--color-surface-overlay);
		border-radius: var(--radius-md);
		background: var(--color-surface-base);
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		font-size: 16px;
		transition: border-color 150ms ease;
		appearance: none;
	}

	.field-select:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.field-select.has-error {
		border-color: var(--color-danger);
	}

	.field-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.field-error {
		font-size: 12px;
		color: var(--color-danger);
		font-family: var(--font-sans);
	}
</style>
