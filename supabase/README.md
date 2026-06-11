# Supabase Migrations

## Apply to remote (production)

```
npx supabase db push
```

## Reset and reseed local (if using local Supabase)

```
npx supabase db reset
```

## Create a new migration

```
npx supabase migration new <name>
```

## Important rules

- NEVER edit a migration file that has already been applied to production.
- Always create a new numbered migration file for schema changes.
- `ingredient_ledger` and `audit_log` are APPEND ONLY — never add UPDATE or DELETE policies.
- `ingredient_stock`, `customer_stats`, and `active_shift` are VIEWS — never store
  computed values as columns.

## Bootstrapping the first owner

RLS requires an existing owner to manage profiles, and `profiles.id` references
`auth.users`, so the first owner is created out-of-band:

1. Create the first user via Supabase Auth (sign-up or the dashboard).
2. With the service role (SQL editor / `psql` as `postgres`), insert/promote their profile:

   ```sql
   insert into public.profiles (id, full_name, role)
   values ('<auth-user-id>', 'Nombre del dueño', 'owner')
   on conflict (id) do update set role = 'owner';
   ```

## Security model notes

- Owner checks go through the `is_owner()` SECURITY DEFINER helper — never inline a
  `select ... from profiles` inside a policy (it causes `42P17` infinite recursion).
- A trigger blocks non-owners from changing their own `role` / `is_active`.
- `ingredient_ledger` and `audit_log` are immutable: append-only triggers reject
  UPDATE/DELETE for every role (including `service_role`).
- Views use `security_invoker = true`, so the caller's RLS is enforced.
- PART 17 grants the Data API roles explicitly — Supabase cloud no longer
  auto-exposes new objects (default flipped 2026-05-30). `anon` is intentionally
  left ungranted (auth-only app).

---

# Telegram Edge Functions

All Telegram notification logic lives server-side in `supabase/functions/` so the
bot token and the service-role key never reach the browser. The frontend only
fires fire-and-forget triggers (via `notificationsDb` in `src/lib/db.ts`); a
Telegram failure NEVER blocks the UI or fails an order — it only logs a
`console.warn`.

## The functions

| Function              | Trigger                                                                 | Sends                                                                                                     |
| --------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `notify-shift-opened` | A shift opens (also the Settings "send test" button, with `_test:true`) | "🟢 Turno abierto" — or a connection-test message                                                         |
| `notify-shift-closed` | A shift closes                                                          | "📊 Reporte de cierre" — full daily report (sales, payment-method breakdown, top products, cash variance) |
| `notify-low-stock`    | After every order confirm                                               | One batched "⚠️ Alerta de stock" listing every ingredient at/below `min_stock` (skips if none)            |
| `notify-large-sale`   | After every order confirm                                               | "💰 Venta grande" when the order total ≥ `large_sale_threshold` (default $20)                             |
| `notify-override`     | After confirming an order with a zero-stock override item               | "⚠️ Venta sin stock" with item + note                                                                     |

`_shared/` holds the common code (Telegram sender, service-role client, report
builder, CORS helpers). The leading underscore keeps Supabase from treating it as
a deployable function.

## Configuration

Everything is configured from the in-app **Settings → Notificaciones Telegram**
screen (no env vars): the bot token, the chat id, the per-event alert toggles, and
the large-sale threshold are stored as rows in the `settings` table and read by the
functions at call time. Use the **"Enviar mensaje de prueba"** button to verify the
token + chat id (it sends regardless of the toggles).

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Supabase Edge runtime — no manual secret setup is needed.

## CORS

The app is a SPA, so `supabase.functions.invoke()` runs in the browser and is
cross-origin → the browser sends a CORS preflight `OPTIONS`. Every function answers
`OPTIONS` and echoes CORS headers on all responses (`_shared/cors.ts`). Functions
keep the default `verify_jwt = true`, so only authenticated app users can invoke
them (the owner's Telegram can't be spammed via the public anon key).

## Deploy

```
npx supabase functions deploy notify-shift-opened --project-ref obbtmocyuqcblvlasini
npx supabase functions deploy notify-shift-closed --project-ref obbtmocyuqcblvlasini
npx supabase functions deploy notify-low-stock    --project-ref obbtmocyuqcblvlasini
npx supabase functions deploy notify-large-sale   --project-ref obbtmocyuqcblvlasini
npx supabase functions deploy notify-override     --project-ref obbtmocyuqcblvlasini
```

Deployment requires an active `npx supabase login`.

---

# E2E Testing (Playwright)

Tests run against the local dev server with a real Supabase connection.

## Setup

1. Copy `e2e/.env.test` and fill in real credentials
2. Ensure the owner account exists (run `scripts/bootstrap.mjs` if needed)

## Run

```bash
npm run test:e2e           # headless
npm run test:e2e:ui        # interactive UI mode
npm run test:e2e:debug     # step through tests
```

## Test suites

- `auth.spec.ts` — login, logout, redirect guards
- `navigation.spec.ts` — all routes load, sidebar/bottom-nav breakpoints
- `shifts.spec.ts` — open shift, topbar badge, close shift
- `pos.spec.ts` — menu loads, add to cart, complete order
- `ingredients.spec.ts` — stock tab, movements tab, restock modal
- `dashboard.spec.ts` — KPIs, chart, top products
- `mobile.spec.ts` — 390px layout, bottom nav overlap

## Notes

- Tests are sequential (`workers: 1`) — shared Supabase state
- Each test that opens a shift cleans up after itself
- Never hardcode credentials — use `e2e/.env.test`
