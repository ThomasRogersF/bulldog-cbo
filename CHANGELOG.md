# Changelog

All notable changes to Bulldog CBO are documented here.
Format: `[version] [date] — description`

## [0.0.5] — 2026-06-08

Shift open/close UX overhaul + POS shift context.

- Close shift: redesigned the modal into a proper end-of-day flow — an
  read-only **Resumen del turno** (shift # + duration, prominent USD total with
  Bs secondary, order count, payment-method breakdown, top 3 items by qty)
  above a **Cierre de caja** section. Counted-cash input shows the expected
  amount and a live variance (✅ sin diferencia / ⬆️ sobrante / ⬇️ faltante),
  notes, a big red "Cerrar turno" button and a small "Cancelar" link. The modal
  body scrolls on mobile.
- Open shift: friendly time-based greeting (Buenos días/tardes/noches 👋) with
  the worker's name and the last closed shift's takings ("Ayer: N órdenes ·
  $X.XX") above the opening-cash field.
- Permissions: any authenticated user (owner or worker) can close a shift —
  verified there was no owner-only guard in `shiftsDb.close()` or on the close
  button to remove (the route + RLS already allow workers).
- POS: a context strip below the TopBar — when a shift is open it shows
  "Turno #N · N órdenes · $X.XX vendido hoy"; when none is open it shows a
  yellow warning ("Las ventas no se registrarán correctamente") with an
  "Abrir turno →" link, replacing the old full-screen block so the menu stays
  usable.
- Data layer: add `ordersDb.listConfirmedForShift()` (confirmed orders with
  items) to drive the close summary from one query.

## [0.0.4] — 2026-06-08

Fixes found during device testing.

- PWA meta: add the standard `mobile-web-app-capable` alongside the existing
  `apple-mobile-web-app-capable` in `src/app.html`.
- Favicon: add a static `static/favicon.svg` (brand red + 🌭) referenced from
  `app.html`, with a `favicon.ico` fallback; drop the bundled-asset `<link>`
  from `+layout.svelte` so the static icon wins (no duplicate icon link).
- Auth store (`auth.svelte.ts`): clear Svelte's `assignment_value_stale`
  warning — assign `profile` to a local first and use a block-body `.then`,
  never reading a `$state` property back from its own assignment expression.
- Responsive nav: move the sidebar / bottom-nav toggle from `md:` (768px) to
  `lg:` (1024px) so phones and tablets get the bottom nav and only desktops
  (≥1024px) get the sidebar (`+layout.svelte`, `NavBar.svelte`, `TopBar.svelte`).

## [0.0.3] — 2026-06-08

Build the full application on top of the schema: auth, app shell, and all screens.

- Foundation: add `uuid` (v7 client IDs via `src/lib/utils/id.ts`); full TypeScript
  types for every table/view/DTO (`src/lib/types/index.ts`); display formatters
  (`src/lib/utils/format.ts`); and pure, unit-tested domain logic
  (`src/lib/domain/{money,recipe,stock,cart}.ts`).
- Data layer (`src/lib/db.ts`): replace the stub with `auth`, `profilesDb`,
  `menuDb`, `ingredientsDb`, `ordersDb`, `customersDb`, `shiftsDb`, `settingsDb`.
  Per-table mappers coerce PostgREST `numeric` strings to numbers; all calls throw
  on error; soft deletes; session/active-shift injection. `ordersDb.confirm()`
  writes `sale` ledger movements by expanding each item's recipe (no DB trigger
  does this). Stock and customer/shift stats are always read from the computed
  views, never stored.
- Reactive stores (`src/lib/stores/*.svelte.ts`, runes `$state`): `auth`, `shift`,
  `cart` (in-memory until park/confirm, derived totals), `nav` (role-filtered),
  `toast`, and `realtime` (one channel → a version-counter bus screens `$effect` on).
- Component library (`src/lib/components/`): Button, Card, Badge, LoadingSpinner,
  EmptyState, Modal, BottomSheet, ConfirmDialog, Input, Select, QtyStepper, Toast,
  StockBar, OrderTypeToggle, PaymentMethodGrid, MenuItemCard, CartLine, OrderCard,
  KpiCard, plus the shell's NavBar/TopBar. Touch-first (≥48px), CSS-variable
  tokens only, 150ms transitions.
- App shell + auth: SPA-only `+layout.ts` (`ssr=false`), a runes `+layout.svelte`
  that bootstraps auth / active shift / realtime, gates on a full-screen loader,
  and enforces login + owner-only route redirects; responsive `NavBar` (desktop
  sidebar / mobile bottom nav + "Más" sheet) and mobile `TopBar`; a centered
  `/login` screen; and the root redirect (owner → `/dashboard`, worker → `/pos`).
- Screens: POS (two-panel menu/cart, category pills, out-of-stock override flow,
  park/confirm/add-to-existing, success overlay), Orders (Abiertas + Historial,
  cancel, detail), Dashboard (KPIs, hand-rolled SVG sales-by-hour + top-items,
  low-stock alerts with quick restock, active-shift card), Ingredients (stock +
  movimientos tabs, restock/adjust/add, ledger feed), Menu (items + recipe editor,
  recetas tab), Customers (search, detail, order history, credit payment), Shifts
  (open/close with cash reconciliation, payment breakdown, history), Settings.
- i18n: expand the es-VE catalog to cover every screen + enum (229 keys); add a
  catalog test asserting all enum values resolve through `t()`.
- Tests: add node unit tests for money, recipe expansion, stock, cart, formatters,
  and UUID v7 (34 tests). `npm run check`, `npm run lint`, `npm run test` are clean.
- Bootstrap (`scripts/bootstrap.mjs` + `.env.example`): a service-role script that
  creates the first owner auth user + profile and seeds a realistic catalog (menu,
  ingredients, recipes, opening-stock ledger, customers). Idempotent; reuses any
  pre-seeded categories by name. The anon key cannot create users, so this is the
  intended bootstrap path. Default login: `owner@bulldogcbo.com` / `bulldog123`.
- Deviations from the spec/CLAUDE.md, by design: `db.ts` uses a `*Db` namespace
  form (e.g. `menuDb.items.list()`) rather than the illustrative `menuItems.list()`,
  to allow nested sub-namespaces and avoid clashing with store names. The zero-stock
  override is recorded on `order_items.override_reason` (the `sale` ledger entry at
  confirm still drives the ingredient negative), rather than a separate zero-qty
  `manual_override` ledger row, since that row would need an arbitrary ingredient id.

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
