# Changelog

All notable changes to Bulldog CBO are documented here.
Format: `[version] [date] — description`

## [0.0.2] — 2026-06-07

- Add the full database schema as Supabase migrations (`supabase/migrations/`):
  profiles, shifts, ingredients + append-only ledger, menu, recipes, customers,
  orders, order_items, audit_log, settings; computed views (`ingredient_stock`,
  `customer_stats`, `active_shift`); RLS on every table; realtime publication.
- Install the Supabase CLI (`supabase` devDependency) and run `supabase init`.
- Pre-apply review fixes (schema not yet applied; validated against the PG15 grammar):
  - Replace recursive inline owner checks with a SECURITY DEFINER `is_owner()`
    helper — fixes RLS infinite recursion (42P17) on `profiles` and 7 tables.
  - Trigger guard blocks a worker from self-escalating `role`/`is_active`.
  - Enforce one open shift globally; enforce append-only ledgers via triggers.
  - `security_invoker = true` on views; pinned `search_path` on all functions.
  - PART 17 grants the Data API roles (Supabase cloud auto-expose is now off).

## [0.0.1] — 2026-06-07

- Scaffold SvelteKit + Svelte 5 (runes only) + TypeScript (strict).
- Add Tailwind CSS 3 with CSS-variable design tokens (`src/lib/design/`).
- Add Supabase client behind the `src/lib/db.ts` abstraction layer.
- Add i18n foundation (es-VE) with dot-path `t()` lookup.
- Add PWA manifest, theme tokens, and the Inter font.
- Document non-negotiable conventions in `CLAUDE.md`.
