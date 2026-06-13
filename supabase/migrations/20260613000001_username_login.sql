-- Add username column to profiles
alter table profiles add column username text;

-- Case-insensitive uniqueness
create unique index idx_profiles_username_lower
  on profiles (lower(username))
  where deleted_at is null;

-- Backfill the existing owner with a default username
update profiles set username = 'dueno'
where role = 'owner' and username is null;

-- Make username required going forward (after backfill)
alter table profiles alter column username set not null;

-- Function: look up email by username (SECURITY DEFINER so it
-- can read auth.users, callable by anon for the login screen)
create or replace function get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select au.email::text
  from profiles p
  join auth.users au on au.id = p.id
  where lower(p.username) = lower(p_username)
    and p.deleted_at is null
  limit 1
$$;

grant execute on function get_email_by_username(text) to anon, authenticated;
