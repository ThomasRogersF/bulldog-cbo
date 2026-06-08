import { colors, radius, fontFamily } from './tokens';

export function buildThemeCss(): string {
	const lightVars = Object.entries(colors.light)
		.map(([k, v]) => `  --color-${k}: ${v};`)
		.join('\n');

	const darkVars = Object.entries(colors.dark)
		.map(([k, v]) => `  --color-${k}: ${v};`)
		.join('\n');

	const radiusVars = Object.entries(radius)
		.map(([k, v]) => `  --radius-${k}: ${v};`)
		.join('\n');

	return `
:root {
${lightVars}
${radiusVars}
  --font-sans: ${fontFamily.sans};
  --font-mono: ${fontFamily.mono};
}

[data-theme="dark"] {
${darkVars}
}
  `.trim();
}
