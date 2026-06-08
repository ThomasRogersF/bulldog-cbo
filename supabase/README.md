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
