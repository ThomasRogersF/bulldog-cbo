/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,ts,svelte}'],
	theme: {
		extend: {
			colors: {
				mustard: 'var(--color-mustard)',
				surface: 'var(--color-surface)',
				'surface-2': 'var(--color-surface-2)',
				'surface-3': 'var(--color-surface-3)',
				line: 'var(--color-line)',
				tx: 'var(--color-text)',
				'tx-dim': 'var(--color-text-dim)',
				'tx-faint': 'var(--color-text-faint)',
				'brand-green': 'var(--color-green)',
				'brand-amber': 'var(--color-amber)',
				'brand-red': 'var(--color-red)'
			},
			fontFamily: {
				sans: ["'Archivo'", 'system-ui', 'sans-serif']
			},
			borderRadius: {
				card: '18px',
				btn: '12px',
				tile: '16px'
			}
		}
	},
	plugins: []
};
