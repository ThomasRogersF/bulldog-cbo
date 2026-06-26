# Changelog

All notable changes to Bulldog CBO are documented here.
Format: `[version] [date] — description`

## [0.1.6] — 2026-06-26

Owner-only user management screen at /users. Owners can create worker accounts (username + temporary password), reset any user's password, deactivate accounts (bans the Supabase Auth session immediately), and reactivate them — all without touching the Supabase dashboard. User creation and auth operations go through a new `manage-user` Edge Function that uses the service role key. Route is protected by the root layout OWNER_ONLY guard; workers who navigate to /users are redirected to /pos.

## [0.1.5] — 2026-06-21

Fix revenue-accuracy bug: items added to a parked order after resuming it were silently lost when the order was confirmed. Root cause — the cart store is in-memory only; for a resumed order, `confirmOrder()` called `ordersDb.confirm()` directly, which re-reads `order_items` from the DB. Any items added or removed from the cart after resuming were never written to the DB, so the confirmed order only contained what was present at the original park time. Fix: before confirming an existing order, call a new `ordersDb.replaceItems()` that deletes and re-inserts `order_items` from the current local cart, ensuring the DB matches exactly what the worker sees in the cart. Secondary fix: `loadExistingOrder()` now restores the parked order's discount to `cartStore.discount` (it was previously reset to 0 on resume). Adds a Playwright regression test for the park → resume → add → confirm flow.

## [0.1.4] — 2026-06-20

Automatic BCV exchange rate fetching via `fetch-bcv-rate` Edge Function (dolarapi.com, every 30 minutes via pg_cron). Manual override in Settings still works and is respected for 30 minutes before auto-fetch resumes. Settings screen now shows the rate prominently with source label (Automática / Manual) and relative timestamp. Adds `usd_rate_source` and `usd_rate_fetched_from` settings keys, `settingsDb.refreshBcvRate()` in `db.ts`, and a "Actualizar desde BCV ahora" button for on-demand refresh. Edge Function runs with `verify_jwt = false` (no user input; public price feed).

## [0.1.3] — 2026-06-20

Shared date range filter (`DateRangeFilter` component) wired into Pedidos (history tab), Ingredientes (movements tab), Clientes, and Turnos. Presets: Hoy / Ayer / Esta semana / Este mes / Todo / Rango personalizado. Each screen's filter drives both the visible list and the export — they always show identical data. Defaults: orders history = today, movements = week, customers = all, shifts = month. Adds `src/lib/utils/dateRange.ts` utility, `calendar` icon to `Icon.svelte`, and a `dateRange` i18n namespace to `es.ts`.

## [0.1.2] — 2026-06-20

CSV, Excel, and PDF export for Pedidos, Ingredientes, Clientes, and Turnos. All generation is client-side (`xlsx`, `jspdf`, `jspdf-autotable`). Each screen's "Exportar" button snapshots exactly the currently visible, filtered list. Adds `ExportButton` dropdown component, `src/lib/utils/export.ts` core utility with BOM-prefixed CSV, auto-sized Excel sheets, and PDF reports with Bulldog CBO header + mustard table styling. Adds four icons (`download`, `file-text`, `table`, `file`) to `Icon.svelte` and an `export` i18n namespace to `es.ts`. Mobile: label collapses below 480 px. Bundle size impact: xlsx ~49 kB gz, jspdf ~47 kB gz, jspdf-autotable ~57 kB gz (lazy-loaded per-page).

## [0.1.1] — 2026-06-14

Image upload with client-side compression for menu items. Adds `menu-images` Supabase Storage bucket (2 MB limit, public read, auth write), a `compressImage` Canvas API utility (WebP, 800 px max, 82% quality), `ImageUpload` drop-zone component with drag-and-drop and before/after size stats, `storageDb` namespace in `db.ts`, and wires `image_url` through the menu edit form. POS tiles show the photo with a gradient overlay when one exists, falling back to the FoodGlyph icon. Adds camera icon to Icon set and spinner CSS to `app.css`.

## [0.1.0] — 2026-06-13

Switch login from email to username. Adds `profiles.username` column (case-insensitive unique index), backfills owner as `dueno`, adds `get_email_by_username()` SECURITY DEFINER function for the login flow, and updates the login page, auth store, bootstrap script, and E2E tests accordingly.

## [0.0.9] — 2026-06-12

Progressive Web App — installable on mobile and desktop with offline app-shell
caching.

- **Service worker + manifest (`vite.config.ts`):** added `vite-plugin-pwa` via
  `@vite-pwa/sveltekit` (`registerType: 'autoUpdate'`). The generated
  `manifest.webmanifest` carries the full Bulldog icon set (72→512 + maskable),
  `#100F0D` theme/background and `display: standalone`. Workbox precaches the app
  shell (`js,css,html,svg,png,ico,woff,woff2`) with `navigateFallback: '/'`, while
  every `*.supabase.co` request is forced `NetworkOnly` so live data never serves
  stale. The PWA plugin is merged alongside the existing Vitest projects.
- **Real icons (`static/icons/`):** replaced the red placeholder icons with the
  brand icon set (favicon.ico, 16→512 PNGs, maskable 192/512, apple-touch 180).
  Removed `static/{manifest.json,icon-192.png,icon-512.png,favicon.svg,favicon.ico}`
  and the now-obsolete `scripts/gen-icons.mjs`.
- **Manifest link + SW registration (`app.html` + `+layout.svelte`):** `@vite-pwa/sveltekit`
  does not inject into SvelteKit's SSR app.html, so the `<link rel="manifest">` is added
  manually and the service worker is registered via `virtual:pwa-register`
  (`registerSW({ immediate: true })`).
- **iOS standalone (`app.html`, `TopBar`, `NavBar`, `InstallPrompt`):** kept the iOS-only
  meta tags and `apple-touch-icon` (`/icons/icon-180.png`) since iOS ignores the manifest
  for the home-screen icon. `apple-mobile-web-app-status-bar-style` is `black-translucent`
  with `viewport-fit=cover`, and the top bar / bottom nav / install banner pad for
  `env(safe-area-inset-*)` so the status bar and home indicator never overlap content.
- **Install prompt (`InstallPrompt.svelte` + `stores/install.svelte.ts`):** a
  dismissible banner offering one-tap install on Android/desktop
  (`beforeinstallprompt`) or "add to home screen" steps on iOS. Shows once per
  session (sessionStorage); mounted in `+layout.svelte` only when authenticated.
- **Settings → Acerca de:** app version (from `package.json`) plus a "Cómo instalar
  la app" button that re-shows the install banner.

## [0.0.8] — 2026-06-10

Playwright end-to-end test suite — auth, navigation, shifts, POS, ingredients,
dashboard and mobile-layout coverage against the local dev server + real Supabase.

- **Suite (`e2e/`):** seven specs — `auth` (login, bad-credentials banner, redirect
  guards), `navigation` (every route's `h1` title + sidebar/bottom-nav breakpoints),
  `shifts` (open → topbar badge → close), `pos` (menu loads, category filter, add to
  cart, full order confirm, empty-cart disabled), `ingredients` (stock cards,
  movimientos tab, restock modal), `dashboard` (KPIs, chart, top products), and
  `mobile` (390px bottom nav + cart-bar/nav non-overlap). Selectors were mapped
  against the real DOM and resolved i18n strings rather than guessed.
- **Auth via `storageState` (`auth.setup.ts` + `playwright.config.ts`):** a `setup`
  project logs in once and persists the Supabase session; all test projects reuse it.
  Per-test UI login would issue ~30 `signInWithPassword` calls per run and trip
  Supabase's auth rate limit — reuse cuts that to one. `auth.spec.ts` overrides with an
  empty `storageState` so it can exercise the logged-out flows.
- **Config:** `playwright.config.ts` (sequential, `workers: 1` for shared Supabase
  state, auto-starts `npm run dev`), `e2e/.env.test` for credentials (gitignored),
  `test:e2e` / `:ui` / `:debug` scripts, and a Testing section in `supabase/README.md`.
- **App tweaks surfaced by the tests:** `Input.svelte` now auto-generates an `id`
  (`$props.id()`) so its `<label for>` always associates with the input, making
  `getByLabel()` reliable across forms; `app.html` gained a `<title>Bulldog CBO`.

## [0.0.7] — 2026-06-09

Bottom-nav layout fixes — overlap and sidebar/bottom-nav mutual exclusivity.

- **Mutual exclusivity (`NavBar.svelte`):** the mobile bottom nav now uses
  `flex lg:hidden` and its scoped `.mobilenav` rule no longer declares
  `display: flex`. A scoped `display` (specificity ~0,2,0) was out-specifying the
  global `lg:hidden` utility (~0,1,0), so the 66px bottom nav stayed visible at
  ≥1024px and rendered alongside the desktop sidebar. Display is now governed only
  by the `flex`/`lg:hidden` utilities, so the two are mutually exclusive (sidebar
  ≥1024px, bottom nav <1024px). The sidebar (`hidden lg:flex`) was already correct.
- **Content clearance (`+layout.svelte`):** the scrollable `.content` container now
  carries `pb-20 lg:pb-0` (80px bottom on mobile to clear the 66px nav with breathing
  room, 0 on desktop), replacing the cramped `@media(max-width:1023px){padding-bottom:70px}`
  (which also out-specified the utility). Per-screen redundant bottom padding trimmed
  so it no longer double-stacks with the layout: `shifts`/`settings` `py-6 → pt-6 lg:pb-6`;
  `dashboard` mobile `.page` bottom `80px → 24px`. `ingredients` keeps `90px` (needed to
  clear its fixed FAB at `bottom:88px`).
- **POS (`pos/+page.svelte`):** the sticky `.cart-actions` got `pb-20 lg:pb-[18px]`
  (80px on mobile so the confirm button clears the nav, 18px desktop as before); its
  CSS shorthand became `padding-top:14px; padding-inline:0` so the utility owns the
  bottom padding.
- **Z-index (`Modal.svelte`):** `.modal` made explicit `z-index: 50` (above the z-40
  nav). `BottomSheet` (`.sheet-root`) was already `z-index: 50`.

## [0.0.6] — 2026-06-09

Telegram notification system — owner push alerts via Supabase Edge Functions.

- **Edge Functions (`supabase/functions/`):** five Deno functions — `notify-shift-opened`,
  `notify-shift-closed` (full daily closing report: sales, payment-method breakdown,
  top products, cash variance), `notify-low-stock` (one batched alert for every
  ingredient at/below `min_stock`), `notify-large-sale` (order total ≥ threshold),
  and `notify-override` (zero-stock sale). Shared code in `_shared/`
  (`telegram.ts` sender, `supabase.ts` service-role client + config loader,
  `report.ts` builder, `cors.ts`). All logic is server-side; the bot token and
  service-role key never reach the browser. Each function reads its alert toggle
  from `settings` and short-circuits when disabled.
- **Frontend triggers (`notificationsDb` in `src/lib/db.ts`):** thin wrappers over
  `supabase.functions.invoke`. Wired fire-and-forget (never awaited, `.catch(() => {})`)
  from `stores/shift.svelte.ts` (open/close) and `routes/pos/+page.svelte`
  `confirmOrder()` (low-stock + large-sale always, override when an item carries an
  `overrideReason`). A Telegram failure only `console.warn`s — it can never block the
  UI or fail an order.
- **Settings:** wired the previously-stubbed "Enviar mensaje de prueba" button to a
  real async handler (`notificationsDb.test()` → `notify-shift-opened` with `_test:true`,
  which bypasses the shift-alerts toggle); added `toasts.testFailed` /
  `toasts.telegramNotConfigured` i18n keys.
- **Spec corrections (by design):** added CORS preflight handling (browser
  `functions.invoke` is cross-origin and would otherwise be blocked); the closing
  report sums Bs from `orders.total_bs`/`orders.usd_rate_used` (the USD rate lives on
  `orders`, not `shifts`); routed the test call through `db.ts` rather than importing
  supabase into a component (CLAUDE.md); and excluded `supabase/functions/**` from
  eslint/prettier (Deno runtime — linted with `deno`, not the SvelteKit toolchain).
- No schema change: all seven `telegram_*`/`*_alerts`/`large_sale_threshold` settings
  rows already exist, and service-role functions bypass RLS.

## [unreleased] — 2026-06-08

Bulldog CBO brand design system — a visual-only redesign (no business-logic,
data, or behavior changes) implementing the Claude Design reference bundle.

- **Theme:** black canvas with **mustard (`#FDCD01`) as the sole hero accent**.
  Dark is now the default (applied pre-paint via an inline script in `app.html`,
  no flash); the Settings light/dark toggle still works and persists. `tokens.ts`
  carries both palettes plus legacy aliases so every `var(--color-*)` resolves in
  either theme; `tokens-css.ts` emits dark into `:root` and light into
  `[data-theme="light"]`, with `--r-card/--r-btn/--r-tile` radii.
- **Typography:** swapped Inter → **Archivo** (`@fontsource/archivo`, weights
  400–900); `--font-mono` now points at Archivo for tabular figures.
- **Icons:** ported a custom line-SVG set — new `Icon.svelte` (46 icons) and
  `FoodGlyph.svelte` (7 food glyphs) — replacing every emoji across the sidebar,
  mobile nav, POS tiles/CTAs, KPI cards, payment grid, order-type toggle, cart
  lines, empty states, settings sections, shift variance, toasts and brand marks.
- **Shell:** new 250px sidebar (logo tile, mustard active nav with dot, green
  pulse shift chip, mustard avatar), a persistent 70px TopBar (page title/subtitle
  from a route map, exchange-rate chip, shift badge, mobile hamburger), and a 66px
  mobile bottom nav. Per-screen page headers removed (the TopBar shows the title).
- **Components restyled (APIs preserved):** Button, Badge (variants remapped to
  the new tones), Card, Input, Select (added chevron), StockBar (added
  `showValue`), Toast, KpiCard, PaymentMethodGrid, OrderTypeToggle, CartLine,
  MenuItemCard (dropped category accent bar; added `qtyInCart`/`bsText` and
  FoodGlyph art), QtyStepper, Modal, EmptyState.
- **Screens:** Dashboard (KPI row, mustard bar chart with peak glow, Top-5,
  active-shift card, low-stock grid), POS (two-panel catalog + cart, search,
  27px mustard total, sticky confirm), Ingredients (segmented control, ingredient
  cards, movements list), Login (dark card + logo). Orders/Menu/Customers/Shifts/
  Settings inherit the system with a coherence pass (tabs, toggle switches, FABs).
- Off-palette category-color defaults in `db.ts` repointed to the new palette.

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
