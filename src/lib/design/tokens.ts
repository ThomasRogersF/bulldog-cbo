// Brand design system for Bulldog CBO — "black canvas, mustard as hero".
// Dark is the reference design (the default theme); light is a derived mirror so
// the existing theme toggle keeps working. Each palette carries BOTH the new
// design token names AND the legacy alias keys, so every var(--color-*) resolves
// in either theme. This is the ONLY file with literal color values — see CLAUDE.md.
export const colors = {
	dark: {
		// Canvas & surfaces
		bg: '#100F0D',
		surface: '#1A1916',
		'surface-2': '#242220',
		'surface-3': '#2F2C28',

		// Lines & borders
		line: 'rgba(255,255,255,0.075)',
		'line-2': 'rgba(255,255,255,0.14)',

		// Text
		text: '#F4F1E9',
		'text-dim': '#A39E92',
		'text-faint': '#6E6A60',

		// Brand accent — mustard is the ONLY hero color
		mustard: '#FDCD01',
		'mustard-deep': '#E0B400',
		'mustard-soft': 'rgba(253,205,1,0.13)',

		// Semantic
		green: '#3DD68C',
		amber: '#FFB020',
		red: '#FF5247',

		// Legacy token aliases (so existing CSS vars still resolve)
		'surface-base': '#100F0D',
		'surface-raised': '#1A1916',
		'surface-overlay': '#242220',
		'text-primary': '#F4F1E9',
		'text-secondary': '#A39E92',
		'text-muted': '#6E6A60',
		accent: '#FDCD01',
		'accent-fg': '#000000',
		'accent-hover': '#E0B400',
		secondary: '#FDCD01',
		'secondary-fg': '#000000',
		danger: '#FF5247',
		'danger-fg': '#ffffff',
		success: '#3DD68C',
		'success-fg': '#000000',
		warning: '#FFB020',
		'warning-fg': '#000000',
		info: '#4A9EFF',
		'info-fg': '#000000',
		overlay: 'rgba(0,0,0,0.75)',
		border: 'rgba(255,255,255,0.075)'
	},
	light: {
		// Canvas & surfaces — mustard hero on warm off-white
		bg: '#FBF8F1',
		surface: '#FFFFFF',
		'surface-2': '#F4EEE3',
		'surface-3': '#E9E2D4',

		// Lines & borders
		line: 'rgba(20,16,8,0.09)',
		'line-2': 'rgba(20,16,8,0.16)',

		// Text
		text: '#1A1712',
		'text-dim': '#6E685C',
		'text-faint': '#9A9384',

		// Brand accent
		mustard: '#FDCD01',
		'mustard-deep': '#E0B400',
		'mustard-soft': 'rgba(253,205,1,0.18)',

		// Semantic (darkened for contrast on light)
		green: '#18A05F',
		amber: '#C77F00',
		red: '#E23B30',

		// Legacy token aliases
		'surface-base': '#FBF8F1',
		'surface-raised': '#FFFFFF',
		'surface-overlay': '#F4EEE3',
		'text-primary': '#1A1712',
		'text-secondary': '#6E685C',
		'text-muted': '#9A9384',
		accent: '#FDCD01',
		'accent-fg': '#000000',
		'accent-hover': '#E0B400',
		secondary: '#FDCD01',
		'secondary-fg': '#000000',
		danger: '#E23B30',
		'danger-fg': '#ffffff',
		success: '#18A05F',
		'success-fg': '#ffffff',
		warning: '#C77F00',
		'warning-fg': '#ffffff',
		info: '#1F6FEB',
		'info-fg': '#ffffff',
		overlay: 'rgba(20,16,8,0.45)',
		border: 'rgba(20,16,8,0.09)'
	}
};

export const radius = {
	sm: '9px',
	md: '12px',
	lg: '16px',
	xl: '18px',
	full: '9999px',
	// Design-named radii (emitted also as --r-card / --r-btn / --r-tile)
	card: '18px',
	btn: '12px',
	tile: '16px'
};

export const fontFamily = {
	sans: "'Archivo', system-ui, -apple-system, sans-serif",
	// Point mono at Archivo so numeric var(--font-mono) usages render in the brand face.
	mono: "'Archivo', system-ui, -apple-system, sans-serif"
};
