
-- Prefix isolates this application from any existing product tables in the same project.
create table public.ea_licenses (
  id uuid primary key default gen_random_uuid(), customer_label text not null check (char_length(customer_label) between 1 and 120),
  key_fingerprint text not null unique check (key_fingerprint ~ '^[a-f0-9]{64}$'), key_ciphertext text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')), expires_at timestamptz not null,
  allowed_account bigint, bound_device_fingerprint text, max_devices smallint not null default 1 check (max_devices = 1),
  last_seen_at timestamptz, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ea_heartbeats (
  id bigint generated always as identity primary key, license_id uuid not null references public.ea_licenses(id) on delete cascade,
  account_number bigint not null, device_fingerprint text not null, ea_version text not null check (char_length(ea_version) <= 40),
  telemetry jsonb not null default '{}'::jsonb, received_at timestamptz not null default now()
);
create index ea_heartbeats_license_received_idx on public.ea_heartbeats (license_id, received_at desc);
create table public.ea_license_nonces (
  nonce text primary key check (char_length(nonce) between 16 and 128), license_id uuid references public.ea_licenses(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '24 hours', created_at timestamptz not null default now()
);
create index ea_license_nonces_expires_idx on public.ea_license_nonces (expires_at);
create index ea_license_nonces_license_idx on public.ea_license_nonces (license_id);
create table public.ea_audit_log (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id), license_id uuid references public.ea_licenses(id) on delete set null,
  action text not null check (char_length(action) <= 80), detail jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index ea_audit_log_license_created_idx on public.ea_audit_log (license_id, created_at desc);
create index ea_audit_log_actor_idx on public.ea_audit_log (actor_id);
alter table public.ea_licenses enable row level security;
alter table public.ea_heartbeats enable row level security;
alter table public.ea_license_nonces enable row level security;
alter table public.ea_audit_log enable row level security;
revoke all on public.ea_licenses, public.ea_heartbeats, public.ea_license_nonces, public.ea_audit_log from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
create or replace function public.ea_touch_updated_at() returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$ begin new.updated_at = now(); return new; end; $$;
create trigger ea_licenses_touch_updated_at before update on public.ea_licenses for each row execute function public.ea_touch_updated_at();
create or replace function public.validate_ea_license(
  p_key_fingerprint text, p_account_number bigint, p_device_fingerprint text, p_nonce text, p_ea_version text, p_telemetry jsonb default '{}'::jsonb
) returns table (authorized boolean, license_id uuid, status text, expires_at timestamptz, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_license public.ea_licenses%rowtype;
begin
  delete from public.ea_license_nonces as nonce_row where nonce_row.expires_at <= now();
  if p_key_fingerprint !~ '^[a-f0-9]{64}$' or char_length(p_nonce) < 16 or char_length(p_nonce) > 128 then return query select false, null::uuid, null::text, null::timestamptz, 'invalid request'; return; end if;
  insert into public.ea_license_nonces(nonce) values (p_nonce) on conflict do nothing;
  if not found then return query select false, null::uuid, null::text, null::timestamptz, 'replayed request'; return; end if;
  select * into v_license from public.ea_licenses where key_fingerprint = p_key_fingerprint for update;
  if not found then return query select false, null::uuid, null::text, null::timestamptz, 'unknown license'; return; end if;
  update public.ea_license_nonces set license_id = v_license.id where nonce = p_nonce;
  if v_license.status <> 'active' then return query select false, v_license.id, v_license.status, v_license.expires_at, 'license is not active'; return; end if;
  if v_license.expires_at <= now() then return query select false, v_license.id, v_license.status, v_license.expires_at, 'license expired'; return; end if;
  if v_license.allowed_account is not null and v_license.allowed_account <> p_account_number then return query select false, v_license.id, v_license.status, v_license.expires_at, 'account is not authorized'; return; end if;
  if v_license.bound_device_fingerprint is not null and v_license.bound_device_fingerprint <> p_device_fingerprint then return query select false, v_license.id, v_license.status, v_license.expires_at, 'device is not authorized'; return; end if;
  update public.ea_licenses set allowed_account = coalesce(allowed_account, p_account_number), bound_device_fingerprint = coalesce(bound_device_fingerprint, p_device_fingerprint), last_seen_at = now() where id = v_license.id;
  insert into public.ea_heartbeats(license_id, account_number, device_fingerprint, ea_version, telemetry) values (v_license.id, p_account_number, p_device_fingerprint, p_ea_version, coalesce(p_telemetry, '{}'::jsonb));
  return query select true, v_license.id, v_license.status, v_license.expires_at, 'ok';
end; $$;
revoke all on function public.validate_ea_license(text, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.validate_ea_license(text, bigint, text, text, text, jsonb) to service_role;
