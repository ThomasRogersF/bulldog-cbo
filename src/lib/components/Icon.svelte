<script lang="ts">
	// Line-icon set ported from the Bulldog CBO design bundle (icons.jsx).
	// Replaces emoji across the app. Usage: <Icon name="cash" size={18} stroke={2.4} />
	const {
		name,
		size = 20,
		stroke = 2,
		class: className = ''
	}: { name: string; size?: number; stroke?: number; class?: string } = $props();

	const PATHS: Record<string, string> = {
		home: '<path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" />',
		register:
			'<rect x="3" y="9" width="18" height="11" rx="1.5" /><path d="M7 9V5a1 1 0 0 1 1-1h6l3 3v2" /><path d="M7 13h4" /><path d="M15 13h2M15 16.5h2" />',
		receipt:
			'<path d="M6 3h12v18l-2.2-1.4L13.6 21 12 19.6 10.4 21 8.2 19.6 6 21Z" /><path d="M9 8h6M9 12h6" />',
		box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" /><path d="m3.5 7.5 8.5 4.6 8.5-4.6" /><path d="M12 12.1V21" />',
		utensils:
			'<path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11" /><path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5ZM16 16v5" />',
		users:
			'<circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" /><path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 20" />',
		clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />',
		grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />',
		gear: '<circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" />',
		more: '<circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />',
		cash: '<rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" />',
		bag: '<path d="M5 8h14l-1 12H6L5 8Z" /><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />',
		tag: '<path d="M3.5 11.5 11 4h7v7l-7.5 7.5a2 2 0 0 1-2.8 0L3.5 14.3a2 2 0 0 1 0-2.8Z" /><circle cx="14.5" cy="7.5" r="1.3" />',
		card: '<rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 9.5h19M6 14.5h4" />',
		phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" />',
		bank: '<path d="M3 9.5 12 4l9 5.5" /><path d="M5 9.5V18M9.5 9.5V18M14.5 9.5V18M19 9.5V18" /><path d="M3 20.5h18" />',
		wallet:
			'<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h11a2 2 0 0 1 2 2" /><rect x="3.5" y="7.5" width="17" height="11" rx="2" /><circle cx="16.5" cy="13" r="1.3" />',
		coin: '<circle cx="12" cy="12" r="9" /><path d="M12 7.5v9M9.5 9.8h3.2a1.7 1.7 0 0 1 0 3.4H9.8h3a1.7 1.7 0 0 1 0 3.3H9.5" />',
		globe:
			'<circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18" />',
		creditclock:
			'<circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /><path d="M8 16.5h8" />',
		minus: '<path d="M5 12h14" />',
		plus: '<path d="M12 5v14M5 12h14" />',
		trash:
			'<path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" />',
		cart: '<circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M2.5 4h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L20 7H6" />',
		search: '<circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" />',
		check: '<path d="M5 12.5 10 17.5 19.5 7" />',
		checkcircle: '<circle cx="12" cy="12" r="9" /><path d="m8 12.2 2.7 2.8L16 9.5" />',
		x: '<path d="M6 6l12 12M18 6 6 18" />',
		chevronRight: '<path d="m9 5 7 7-7 7" />',
		chevronDown: '<path d="m5 9 7 7 7-7" />',
		chevronLeft: '<path d="m15 5-7 7 7 7" />',
		arrowUp: '<path d="M12 19V5M6 11l6-6 6 6" />',
		arrowDown: '<path d="M12 5v14M6 13l6 6 6-6" />',
		arrowRight: '<path d="M5 12h14M13 6l6 6-6 6" />',
		alert: '<path d="M12 3 1.5 21h21L12 3Z" /><path d="M12 10v5M12 18h.01" />',
		bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" />',
		refill: '<rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M12 8v8M8 12h8" />',
		edit: '<path d="M4 20h4l11-11a2 2 0 0 0-3-3L5 17v3Z" /><path d="M14 6l3 3" />',
		percent:
			'<path d="M6 18 18 6" /><circle cx="7.5" cy="7.5" r="2" /><circle cx="16.5" cy="16.5" r="2" />',
		dollar:
			'<path d="M12 3v18" /><path d="M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5s1.8 2.7 4 3.2 4 1.4 4 3.3-1.8 3-4 3-4-1.1-4-3" />',
		swap: '<path d="M7 4 3.5 7.5 7 11" /><path d="M3.5 7.5H17" /><path d="m17 20 3.5-3.5L17 13" /><path d="M20.5 16.5H7" />',
		sparkle: '<path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18 10.3 12.4 5 10.7 10.3 9 12 3.5Z" />',
		pin: '<path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" />',
		flame:
			'<path d="M12 3c2 3 5 4.2 5 8a5 5 0 0 1-10 0c0-1.6.8-2.8 1.5-3.5.3 1 1 1.8 2 2 0-2.8.4-4.8 1.5-6.5Z" />',
		eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />',
		crown: '<path d="M4 8l3.5 3 4.5-6 4.5 6L20 8l-1.5 10h-13L4 8Z" />',
		camera:
			'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7l-1.5-3h-5L8 7"/><circle cx="12" cy="14" r="3.5"/>',
		download: '<path d="M12 3v13M7 11l5 5 5-5" /><path d="M5 20h14" />',
		'file-text':
			'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" />',
		table:
			'<rect x="3" y="3" width="18" height="18" rx="1.5" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />',
		file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M13 2v7h7" />',
		calendar: '<rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />'
	};

	const inner = $derived(PATHS[name] ?? PATHS.grid);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden="true"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html inner}
</svg>
