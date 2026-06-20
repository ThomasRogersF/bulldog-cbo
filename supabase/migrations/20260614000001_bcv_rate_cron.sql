-- Add settings keys for BCV rate source tracking
insert into settings (key, value, description) values
  ('usd_rate_source',      'manual', 'Origen de la última actualización de tasa: auto | manual'),
  ('usd_rate_fetched_from', null,    'Fuente del último fetch automático de tasa')
on conflict (key) do nothing;

-- Enable pg_cron and pg_net for scheduled HTTP calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the fetch-bcv-rate Edge Function every 30 minutes.
-- verify_jwt = false in config.toml, so no Authorization header needed.
select cron.schedule(
  'fetch-bcv-rate-every-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://obbtmocyuqcblvlasini.supabase.co/functions/v1/fetch-bcv-rate',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);
