<script module lang="ts">
	export type GlyphName = 'hotdog' | 'burger' | 'soda' | 'water' | 'fries' | 'stick' | 'sauce';

	// Map a menu item's name/category text to the closest food glyph.
	export function categoryToGlyph(text: string | null | undefined): GlyphName {
		const s = (text ?? '').toLowerCase();
		if (s.includes('perro') || s.includes('hot') || s.includes('salchich')) return 'hotdog';
		if (s.includes('hamburg') || s.includes('burger')) return 'burger';
		if (s.includes('agua') || s.includes('water')) return 'water';
		if (s.includes('bebida') || s.includes('refresco') || s.includes('malta') || s.includes('soda'))
			return 'soda';
		if (s.includes('teque') || s.includes('stick')) return 'stick';
		if (
			s.includes('papa') ||
			s.includes('fries') ||
			s.includes('acompa') ||
			s.includes('porción') ||
			s.includes('porcion')
		)
			return 'fries';
		if (s.includes('salsa') || s.includes('extra') || s.includes('queso') || s.includes('mayo'))
			return 'sauce';
		return 'burger';
	}
</script>

<script lang="ts">
	// Line food glyphs for product-photo placeholders (ported from icons.jsx FoodGlyph).
	const {
		name,
		size = 30,
		stroke = 1.6,
		class: className = ''
	}: { name: GlyphName | string; size?: number; stroke?: number; class?: string } = $props();

	const GLYPHS: Record<string, string> = {
		hotdog:
			'<path d="M5 20c-2-2-2-6 1-8s7-2 9 0l5 5c2 2 2 6-1 8s-7 2-9 0Z" /><path d="M10 12c2 1 8 7 9 9" /><path d="M8 16c1.5-1 3.5-1 5 0M14 12c1.5-1 3.5-1 5 0" />',
		burger:
			'<path d="M6 11c0-3.3 4.5-5 10-5s10 1.7 10 5" /><path d="M6 11h20" /><path d="M5.5 15.5h21M6 15.5c1 1.6 3 1.6 4 0s3-1.6 4 0 3 1.6 4 0 3-1.6 4 0" /><path d="M7 19.5h18a2 2 0 0 1-2 3.5H9a2 2 0 0 1-2-3.5Z" />',
		soda: '<path d="M9 9h14l-1.5 16h-11L9 9Z" /><path d="M8 9l1-3h15l-1 3" /><path d="M12 13l1 9M20 13l-1 9M16 13v9" />',
		water:
			'<path d="M12 4h8v3l1 3v15H11V10l1-3Z" /><path d="M11 14h10" /><path d="M13 2h6v2h-6Z" />',
		fries:
			'<path d="M8 13h16l-1.5 12a2 2 0 0 1-2 1.8H11.5a2 2 0 0 1-2-1.8L8 13Z" /><path d="M8 13l1-1h14l1 1" /><path d="M11 13 10 5M15 13l-.5-9M20 13l1-7" />',
		stick:
			'<rect x="7" y="6" width="6" height="20" rx="3" transform="rotate(-20 10 16)" /><rect x="17" y="6" width="6" height="20" rx="3" transform="rotate(20 20 16)" />',
		sauce:
			'<path d="M11 4h6l1 5-1 2v13a2 2 0 0 1-6 0V11l-1-2Z" /><path d="M12 4V2.5h4V4" /><path d="M11.5 14h5" />'
	};

	const inner = $derived(GLYPHS[name] ?? GLYPHS.burger);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 32 32"
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
