# CLAUDE.md — Bulldog CBO Development Conventions

## Stack

- SvelteKit + Svelte 5 (runes only)
- TypeScript strict
- Tailwind CSS 3 with CSS variable design tokens
- Supabase (Postgres + Auth + Realtime + Edge Functions)

## Hard Rules

### Svelte 5 Runes Only

- NO `export let` — use `$props()`
- NO `$:` reactive statements — use `$derived()` and `$effect()`
- NO `writable()` Svelte stores — use `.svelte.ts` files with `$state()`
- NO top-level `let` for reactive state in components
- Shared state lives in `src/lib/stores/*.svelte.ts` files

### Data Layer

- ALL Supabase calls go through `src/lib/db.ts` — never import supabase.ts directly in components
- Stock quantities are NEVER stored columns — always SUM(qty_change) from ingredient_ledger
- Customer totals (purchase_count, total_spent) are NEVER stored — always computed via query
- Always use UUID v7 for IDs generated client-side (use the `uuid` package, v7 method)
- Soft deletes only — set deleted_at, never hard DELETE

### Styling

- NEVER hardcode hex colors, font names, or border radii in components
- Always use CSS variables: var(--color-accent), var(--radius-md), var(--font-sans)
- All monetary/quantity values must use tabular numbers: font-variant-numeric: tabular-nums

### i18n

- Every user-facing string goes through t() — never hardcode Spanish text in components
- Call t() in the template, never in a top-level const

### Naming

- Files: kebab-case (menu-items.ts, order-detail.svelte)
- Components: PascalCase (MenuItemCard.svelte)
- Stores: camelCase with .svelte.ts extension (orders.svelte.ts)
- DB functions in db.ts: camelCase, domain-prefixed (menuItems.list(), orders.create())

### Changelog

- Every meaningful change adds an entry to CHANGELOG.md
- Format: [version] [date] — description

## Architecture

- Routes: /pos, /orders, /menu, /ingredients, /customers, /shifts, /dashboard, /settings
- All data operations through src/lib/db.ts
- All strings through src/lib/i18n/index.ts t() function
- All reactive shared state in src/lib/stores/\*.svelte.ts
- Design tokens in src/lib/design/tokens.ts (only file with literal color values)
