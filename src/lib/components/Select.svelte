<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';

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
	<span class="select-wrap">
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
		<span class="select-chevron" aria-hidden="true"><Icon name="chevronDown" size={16} /></span>
	</span>
	{#if error}
		<span class="field-error">{error}</span>
	{/if}
</label>

<style>
	.field-label {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-family: var(--font-sans);
	}

	.select-wrap {
		position: relative;
		display: block;
		width: 100%;
	}

	.select-chevron {
		position: absolute;
		top: 50%;
		right: 12px;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		color: var(--color-text-dim);
		pointer-events: none;
	}

	.field-select {
		min-height: 48px;
		padding: 12px 38px 12px 14px;
		border: 1px solid var(--color-line-2);
		border-radius: 11px;
		background: var(--color-surface-2);
		color: var(--color-text);
		font-family: var(--font-sans);
		font-size: 15px;
		transition: border-color 150ms ease;
		appearance: none;
	}

	.field-select:focus {
		outline: none;
		border-color: var(--color-mustard);
	}

	.field-select.has-error {
		border-color: var(--color-red);
	}

	.field-select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.field-error {
		font-size: 12px;
		color: var(--color-red);
		font-family: var(--font-sans);
	}
</style>
