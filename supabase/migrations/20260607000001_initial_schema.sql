-- =============================================================================
-- Bulldog CBO — Initial Schema
-- POS + inventory for a Venezuelan hot dog food cart.
-- Single migration, ordered by dependency.
--
-- NOTE: This file has NOT been applied yet. Several correctness/security fixes
-- were folded in after review (see CHANGELOG 0.0.2):
--   * is_owner() SECURITY DEFINER helper replaces inline "select from profiles"
--     owner checks, which otherwise cause RLS infinite recursion (42P17).
--   * Trigger guard prevents a worker from self-escalating role/is_active.
--   * One open shift enforced GLOBALLY.
--   * Append-only enforced with block_mutation() triggers (not just convention).
--   * Views use security_invoker so RLS is honored.
--   * Functions pin search_path. PART 17 grants the Data API roles (cloud's
--     auto-expose default flipped to false on 2026-05-30).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1 — Extensions & Helpers
-- -----------------------------------------------------------------------------

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Helper: automatically update updated_at on any row mutation
create or replace function update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Generic guard: make a table append-only by blocking UPDATE/DELETE at the row
-- level (fires for every role, including service_role / table owner).
create or replace function block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Tabla de solo-inserción (append-only): % no permitido en %', tg_op, tg_table_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- PART 2 — Profiles (users)
-- -----------------------------------------------------------------------------

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'worker' check (role in ('owner', 'worker')),
  pin         text,                        -- optional quick-login PIN. NOTE: hash app-side; do not store raw.
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- RLS-safe owner check. SECURITY DEFINER so its read of profiles bypasses RLS,
-- which avoids the infinite recursion (42P17) you get from selecting profiles
-- inside a profiles policy. STABLE. Used by every owner-only policy below.
create or replace function is_owner()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'owner' and deleted_at is null
  );
$$;

-- RLS
alter table profiles enable row level security;

-- Owners can see all profiles
create policy "owners_read_all_profiles"
  on profiles for select
  using (is_owner());

-- Workers can only read their own profile
create policy "workers_read_own_profile"
  on profiles for select
  using (auth.uid() = id);

-- Only owners can insert/update profiles
create policy "owners_manage_profiles"
  on profiles for all
  using (is_owner());

-- Users can update their own profile, BUT non-owners may not change role or
-- is_active (enforced by the trigger below — an RLS WITH CHECK cannot see OLD).
create policy "users_update_own_profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Block privilege escalation: a non-owner cannot change their own role/is_active.
create or replace function guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    if new.role is distinct from old.role then
      raise exception 'No autorizado: no puede cambiar su propio rol';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'No autorizado: no puede cambiar su propio estado';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on profiles
  for each row execute function guard_profile_privileged_columns();

-- BOOTSTRAP: the policies above require an existing owner to create profiles,
-- and profiles.id must reference a real auth.users row. Create the first owner
-- out-of-band with the service role (RLS-bypassing) after the first user signs
-- up, e.g.:  update public.profiles set role = 'owner' where id = '<auth-user-id>';

-- -----------------------------------------------------------------------------
-- PART 3 — Shifts
-- -----------------------------------------------------------------------------

create sequence shift_number_seq start 1;

create table shifts (
  id                  uuid primary key default gen_random_uuid(),
  shift_number        integer not null default nextval('shift_number_seq'),
  opened_by           uuid not null references profiles(id),
  closed_by           uuid references profiles(id),
  opened_at           timestamptz not null default now(),
  closed_at           timestamptz,
  opening_cash_usd    numeric(10,2) not null default 0,
  closing_cash_usd    numeric(10,2),
  expected_cash_usd   numeric(10,2),
  variance_usd        numeric(10,2),
  notes               text,
  telegram_report_sent boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create trigger shifts_updated_at
  before update on shifts
  for each row execute function update_updated_at();

create index idx_shifts_opened_at on shifts(opened_at desc);
create index idx_shifts_closed_at on shifts(closed_at desc) where closed_at is not null;

-- Constraint: only one open shift at a time, GLOBALLY. The constant index
-- expression means at most one row can satisfy the partial predicate.
create unique index idx_shifts_one_open
  on shifts((true))
  where closed_at is null and deleted_at is null;

alter table shifts enable row level security;

create policy "authenticated_read_shifts"
  on shifts for select
  using (auth.uid() is not null);

create policy "workers_insert_shifts"
  on shifts for insert
  with check (auth.uid() is not null);

create policy "workers_update_shifts"
  on shifts for update
  using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- PART 4 — Ingredient Categories
-- -----------------------------------------------------------------------------

create table ingredient_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#6B7280',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger ingredient_categories_updated_at
  before update on ingredient_categories
  for each row execute function update_updated_at();

alter table ingredient_categories enable row level security;

create policy "authenticated_read_ingredient_categories"
  on ingredient_categories for select
  using (auth.uid() is not null);

create policy "owners_manage_ingredient_categories"
  on ingredient_categories for all
  using (is_owner());

-- -----------------------------------------------------------------------------
-- PART 5 — Ingredients
-- -----------------------------------------------------------------------------

create table ingredients (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references ingredient_categories(id),
  name        text not null,
  unit        text not null default 'unit' check (unit in ('unit', 'g', 'ml', 'kg', 'l')),
  min_stock   numeric(10,3) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger ingredients_updated_at
  before update on ingredients
  for each row execute function update_updated_at();

create index idx_ingredients_category on ingredients(category_id) where deleted_at is null;

alter table ingredients enable row level security;

create policy "authenticated_read_ingredients"
  on ingredients for select
  using (auth.uid() is not null);

create policy "owners_manage_ingredients"
  on ingredients for all
  using (is_owner());

-- -----------------------------------------------------------------------------
-- PART 6 — Ingredient Ledger (append-only stock movements)
-- -----------------------------------------------------------------------------

create table ingredient_ledger (
  id              uuid primary key default gen_random_uuid(),
  ingredient_id   uuid not null references ingredients(id),
  order_id        uuid,                    -- FK added later after orders table exists
  shift_id        uuid references shifts(id),
  actor_id        uuid not null references profiles(id),
  qty_change      numeric(10,3) not null,  -- negative = consumed, positive = restocked
  reason          text not null check (reason in (
                    'sale', 'restock', 'adjustment', 'waste', 'manual_override', 'opening_count'
                  )),
  note            text,                    -- required when reason = 'manual_override'
  created_at      timestamptz not null default now()
  -- No updated_at — this table is APPEND ONLY. Never UPDATE or DELETE a row here.
);

-- No update trigger — append only

create index idx_ingredient_ledger_ingredient on ingredient_ledger(ingredient_id, created_at desc);
create index idx_ingredient_ledger_order on ingredient_ledger(order_id) where order_id is not null;
create index idx_ingredient_ledger_shift on ingredient_ledger(shift_id) where shift_id is not null;

alter table ingredient_ledger enable row level security;

create policy "authenticated_read_ingredient_ledger"
  on ingredient_ledger for select
  using (auth.uid() is not null);

create policy "authenticated_insert_ingredient_ledger"
  on ingredient_ledger for insert
  with check (auth.uid() is not null);

-- No update or delete policy — append only by design.
-- Enforce immutability at the row level (blocks even service_role / table owner).
create trigger ingredient_ledger_append_only
  before update or delete on ingredient_ledger
  for each row execute function block_mutation();

-- -----------------------------------------------------------------------------
-- PART 7 — Menu Categories
-- -----------------------------------------------------------------------------

create table menu_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#D62828',
  emoji       text,                        -- e.g. '🌭' '🍔' '🥤' — shows on POS cards
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create trigger menu_categories_updated_at
  before update on menu_categories
  for each row execute function update_updated_at();

alter table menu_categories enable row level security;

create policy "authenticated_read_menu_categories"
  on menu_categories for select
  using (auth.uid() is not null);

create policy "owners_manage_menu_categories"
  on menu_categories for all
  using (is_owner());

-- -----------------------------------------------------------------------------
-- PART 8 — Menu Items
-- -----------------------------------------------------------------------------

create table menu_items (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references menu_categories(id),
  name            text not null,
  description     text,
  price_usd       numeric(10,2) not null check (price_usd >= 0),
  is_available    boolean not null default true,
  image_url       text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger menu_items_updated_at
  before update on menu_items
  for each row execute function update_updated_at();

create index idx_menu_items_category on menu_items(category_id) where deleted_at is null;
create index idx_menu_items_available on menu_items(is_available) where deleted_at is null;

alter table menu_items enable row level security;

create policy "authenticated_read_menu_items"
  on menu_items for select
  using (auth.uid() is not null);

create policy "owners_manage_menu_items"
  on menu_items for all
  using (is_owner());

-- -----------------------------------------------------------------------------
-- PART 9 — Recipes (menu item → ingredients)
-- -----------------------------------------------------------------------------

create table recipes (
  id              uuid primary key default gen_random_uuid(),
  menu_item_id    uuid not null references menu_items(id) on delete cascade,
  ingredient_id   uuid not null references ingredients(id),
  qty_required    numeric(10,3) not null check (qty_required > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique(menu_item_id, ingredient_id)       -- one row per ingredient per menu item
);

create trigger recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();

create index idx_recipes_menu_item on recipes(menu_item_id);
create index idx_recipes_ingredient on recipes(ingredient_id);

alter table recipes enable row level security;

create policy "authenticated_read_recipes"
  on recipes for select
  using (auth.uid() is not null);

create policy "owners_manage_recipes"
  on recipes for all
  using (is_owner());

-- -----------------------------------------------------------------------------
-- PART 10 — Customers
-- -----------------------------------------------------------------------------

create table customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  source          text not null default 'walk_in' check (source in (
                    'walk_in', 'regular', 'delivery', 'referred', 'other'
                  )),
  group_tag       text check (group_tag in ('vip', 'regular', 'crew', 'wholesale')),
  credit_balance_usd numeric(10,2) not null default 0,  -- positive = they owe us
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz

  -- purchase_count, total_spent_usd, last_purchase_at are NEVER stored columns
  -- They are always computed via COUNT() / SUM() / MAX() over orders at query time
);

create trigger customers_updated_at
  before update on customers
  for each row execute function update_updated_at();

create index idx_customers_phone on customers(phone) where phone is not null and deleted_at is null;
create index idx_customers_group on customers(group_tag) where deleted_at is null;

alter table customers enable row level security;

create policy "authenticated_read_customers"
  on customers for select
  using (auth.uid() is not null);

create policy "authenticated_manage_customers"
  on customers for all
  using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- PART 11 — Orders
-- -----------------------------------------------------------------------------

create sequence order_number_seq start 1;

create table orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    integer not null default nextval('order_number_seq'),
  shift_id        uuid references shifts(id),
  customer_id     uuid references customers(id),
  worker_id       uuid not null references profiles(id),
  order_type      text not null default 'takeout' check (order_type in ('dine_in', 'takeout')),
  status          text not null default 'open' check (status in ('open', 'confirmed', 'cancelled')),
  subtotal_usd    numeric(10,2) not null default 0,
  discount_usd    numeric(10,2) not null default 0,
  total_usd       numeric(10,2) not null default 0,
  total_bs        numeric(12,2),
  usd_rate_used   numeric(10,4),
  payment_method  text check (payment_method in (
                    'cash_usd', 'cash_bs', 'card', 'pagomovil',
                    'transfer', 'zinli', 'binance', 'paypal', 'credit'
                  )),
  paid_at         timestamptz,
  confirmed_by    uuid references profiles(id),
  cancelled_at    timestamptz,
  cancelled_by    uuid references profiles(id),
  cancel_reason   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger orders_updated_at
  before update on orders
  for each row execute function update_updated_at();

create index idx_orders_shift on orders(shift_id) where shift_id is not null;
create index idx_orders_customer on orders(customer_id) where customer_id is not null;
create index idx_orders_worker on orders(worker_id);
create index idx_orders_status on orders(status) where deleted_at is null;
create index idx_orders_created on orders(created_at desc);
create index idx_orders_number on orders(order_number);

-- Add FK from ingredient_ledger to orders now that orders exists
alter table ingredient_ledger
  add constraint fk_ingredient_ledger_order
  foreign key (order_id) references orders(id);

alter table orders enable row level security;

create policy "authenticated_read_orders"
  on orders for select
  using (auth.uid() is not null);

create policy "authenticated_manage_orders"
  on orders for all
  using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- PART 12 — Order Items
-- -----------------------------------------------------------------------------

create table order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  menu_item_id          uuid references menu_items(id),
  menu_item_snapshot    jsonb not null,   -- {name, price_usd, category_name} at time of order
  qty                   integer not null default 1 check (qty > 0),
  unit_price_usd        numeric(10,2) not null,
  line_total_usd        numeric(10,2) not null,
  override_reason       text,             -- filled if ordered when ingredient was at zero stock
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger order_items_updated_at
  before update on order_items
  for each row execute function update_updated_at();

create index idx_order_items_order on order_items(order_id);
create index idx_order_items_menu_item on order_items(menu_item_id) where menu_item_id is not null;

alter table order_items enable row level security;

create policy "authenticated_read_order_items"
  on order_items for select
  using (auth.uid() is not null);

create policy "authenticated_manage_order_items"
  on order_items for all
  using (auth.uid() is not null);

-- -----------------------------------------------------------------------------
-- PART 13 — Audit Log
-- -----------------------------------------------------------------------------

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references profiles(id),   -- null for system events
  action        text not null,                   -- e.g. 'order.confirmed', 'shift.closed'
  entity_type   text not null,                   -- e.g. 'order', 'ingredient', 'shift'
  entity_id     uuid not null,
  before        jsonb,
  after         jsonb,
  meta          jsonb,                           -- extra context (e.g. telegram_sent: true)
  created_at    timestamptz not null default now()
  -- Append only — no updated_at, no update/delete policies
);

create index idx_audit_log_entity on audit_log(entity_type, entity_id);
create index idx_audit_log_actor on audit_log(actor_id) where actor_id is not null;
create index idx_audit_log_created on audit_log(created_at desc);
create index idx_audit_log_action on audit_log(action);

alter table audit_log enable row level security;

create policy "owners_read_audit_log"
  on audit_log for select
  using (is_owner());

create policy "authenticated_insert_audit_log"
  on audit_log for insert
  with check (auth.uid() is not null);

-- No update or delete policy — append only.
-- Enforce immutability at the row level (blocks even service_role / table owner).
create trigger audit_log_append_only
  before update or delete on audit_log
  for each row execute function block_mutation();

-- -----------------------------------------------------------------------------
-- PART 14 — Settings
-- -----------------------------------------------------------------------------

create table settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value       text,
  description text,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

-- Seed default settings
insert into settings (key, value, description) values
  ('usd_rate',              '40',    'Tasa de cambio USD → Bs actual'),
  ('usd_rate_updated_at',   null,    'Última actualización de la tasa'),
  ('telegram_bot_token',    null,    'Token del bot de Telegram para notificaciones'),
  ('telegram_chat_id',      null,    'Chat ID del dueño en Telegram'),
  ('large_sale_threshold',  '20',    'Monto en USD que dispara alerta de venta grande'),
  ('business_name',         'Bulldog CBO', 'Nombre del negocio'),
  ('business_phone',        null,    'Teléfono del negocio'),
  ('low_stock_alerts',      'true',  'Enviar alertas de ingredientes bajos por Telegram'),
  ('shift_alerts',          'true',  'Notificar apertura y cierre de turnos'),
  ('large_sale_alerts',     'true',  'Notificar ventas grandes'),
  ('override_alerts',       'true',  'Notificar cuando se vende con stock en cero');

alter table settings enable row level security;

create policy "authenticated_read_settings"
  on settings for select
  using (auth.uid() is not null);

create policy "owners_manage_settings"
  on settings for update
  using (is_owner());

-- -----------------------------------------------------------------------------
-- PART 15 — Useful Views (computed queries as SQL views)
-- security_invoker = true so the caller's RLS is enforced (not the view owner's).
-- -----------------------------------------------------------------------------

-- Current stock per ingredient (always computed, never stored)
create or replace view ingredient_stock with (security_invoker = true) as
select
  i.id,
  i.name,
  i.unit,
  i.min_stock,
  i.category_id,
  ic.name as category_name,
  ic.color as category_color,
  coalesce(sum(il.qty_change), 0) as current_stock,
  coalesce(sum(il.qty_change), 0) <= i.min_stock as is_low_stock,
  coalesce(sum(il.qty_change), 0) <= 0 as is_out_of_stock,
  i.deleted_at
from ingredients i
left join ingredient_categories ic on ic.id = i.category_id
left join ingredient_ledger il on il.ingredient_id = i.id
group by i.id, i.name, i.unit, i.min_stock, i.category_id, ic.name, ic.color, i.deleted_at;

-- Customer stats (always computed, never stored)
create or replace view customer_stats with (security_invoker = true) as
select
  c.id,
  c.name,
  c.phone,
  c.source,
  c.group_tag,
  c.credit_balance_usd,
  c.notes,
  c.created_at,
  c.deleted_at,
  count(o.id) as purchase_count,
  coalesce(sum(o.total_usd), 0) as total_spent_usd,
  max(o.created_at) as last_purchase_at
from customers c
left join orders o on o.customer_id = c.id
  and o.status = 'confirmed'
  and o.deleted_at is null
group by c.id, c.name, c.phone, c.source, c.group_tag,
         c.credit_balance_usd, c.notes, c.created_at, c.deleted_at;

-- Today's shift summary. security_invoker means profiles RLS applies to the
-- caller, so the join is LEFT: a worker still sees the active shift (opener name
-- is null for them, since profiles RLS hides other users' rows); an owner sees it.
create or replace view active_shift with (security_invoker = true) as
select
  s.*,
  p.full_name as opened_by_name,
  count(distinct o.id) filter (where o.status = 'confirmed') as confirmed_orders,
  coalesce(sum(o.total_usd) filter (where o.status = 'confirmed'), 0) as total_sales_usd
from shifts s
left join profiles p on p.id = s.opened_by
left join orders o on o.shift_id = s.id and o.deleted_at is null
where s.closed_at is null and s.deleted_at is null
group by s.id, p.full_name;

-- -----------------------------------------------------------------------------
-- PART 16 — Seed Data (for development)
-- -----------------------------------------------------------------------------

-- Seed menu categories
insert into menu_categories (name, color, emoji, sort_order) values
  ('Hot Dogs',   '#D62828', '🌭', 1),
  ('Hamburguesas', '#E65100', '🍔', 2),
  ('Bebidas',    '#1565C0', '🥤', 3),
  ('Acompañantes', '#F4A400', '🍟', 4),
  ('Postres',    '#6A1B9A', '🍦', 5);

-- Seed ingredient categories
insert into ingredient_categories (name, color, sort_order) values
  ('Carnes',     '#D62828', 1),
  ('Panes',      '#F4A400', 2),
  ('Salsas',     '#E65100', 3),
  ('Bebidas',    '#1565C0', 4),
  ('Vegetales',  '#2E7D32', 5),
  ('Otros',      '#6B7280', 6);

-- -----------------------------------------------------------------------------
-- PART 17 — Data API grants
-- -----------------------------------------------------------------------------
-- Supabase cloud's default (since 2026-05-30) no longer auto-grants new public
-- objects to the Data API roles, so we grant explicitly. RLS policies above are
-- what actually gate row access; these grants only make the objects reachable
-- through PostgREST. `anon` is intentionally NOT granted — this is an
-- authenticated-only app (login goes through Supabase Auth, not these tables).

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- service_role bypasses RLS and is used by server-side / Edge Function code.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
