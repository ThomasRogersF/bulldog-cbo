import { colors, radius, fontFamily } from './tokens';

function paletteVars(palette: Record<string, string>): string {
	return Object.entries(palette)
		.map(([k, v]) => `  --color-${k}: ${v};`)
		.join('\n');
}

export function buildThemeCss(): string {
	const darkVars = paletteVars(colors.dark);
	const lightVars = paletteVars(colors.light);

	const radiusVars = Object.entries(radius)
		.map(([k, v]) => `  --radius-${k}: ${v};`)
		.join('\n');

	// Design-named radius aliases used directly by ported component styles.
	const rAliases = [
		`  --r-card: ${radius.card};`,
		`  --r-btn: ${radius.btn};`,
		`  --r-tile: ${radius.tile};`
	].join('\n');

	// Dark is the default (in :root); light is opt-in via [data-theme="light"].
	return `
:root {
${darkVars}
${radiusVars}
${rAliases}
  --font-sans: ${fontFamily.sans};
  --font-mono: ${fontFamily.mono};
}

[data-theme="light"] {
${lightVars}
}

[data-theme="dark"] {
${darkVars}
}
  `.trim();
}
