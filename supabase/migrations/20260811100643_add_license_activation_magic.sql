-- A generated Magic Number is the per-license activation selector. It is the
-- only visible EA setting, while the account is discovered automatically at runtime.
alter table public.ea_licenses add column activation_magic bigint;

update public.ea_licenses
set activation_magic = floor(random() * 8000000000000000 + 1000000000000000)::bigint
where activation_magic is null;

alter table public.ea_licenses alter column activation_magic set not null;
create unique index ea_licenses_activation_magic_idx on public.ea_licenses(activation_magic);

create or replace function public.validate_ea_license_by_activation(
  p_activation_magic bigint,
  p_account_number bigint,
  p_device_fingerprint text,
  p_nonce text,
  p_ea_version text,
  p_telemetry jsonb default '{}'::jsonb
) returns table (authorized boolean, license_id uuid, status text, expires_at timestamptz, reason text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_license public.ea_licenses%rowtype;
begin
  delete from public.ea_license_nonces as nonce_row where nonce_row.expires_at <= now();
  if p_activation_magic <= 0
     or p_account_number <= 0
     or p_device_fingerprint !~ '^[a-f0-9]{64}$'
     or char_length(p_nonce) < 16 or char_length(p_nonce) > 128 then
    return query select false, null::uuid, null::text, null::timestamptz, 'invalid request';
    return;
  end if;

  insert into public.ea_license_nonces(nonce) values (p_nonce) on conflict do nothing;
  if not found then
    return query select false, null::uuid, null::text, null::timestamptz, 'replayed request';
    return;
  end if;

  select * into v_license
  from public.ea_licenses
  where activation_magic = p_activation_magic
  for update;

  if not found then
    return query select false, null::uuid, null::text, null::timestamptz, 'unknown activation';
    return;
  end if;

  update public.ea_license_nonces set license_id = v_license.id where nonce = p_nonce;
  if v_license.status <> 'active' then
    return query select false, v_license.id, v_license.status, v_license.expires_at, 'license is not active';
    return;
  end if;
  if v_license.expires_at <= now() then
    return query select false, v_license.id, v_license.status, v_license.expires_at, 'license expired';
    return;
  end if;
  if v_license.allowed_account is not null and v_license.allowed_account <> p_account_number then
    return query select false, v_license.id, v_license.status, v_license.expires_at, 'account is not authorized';
    return;
  end if;
  if v_license.bound_device_fingerprint is not null and v_license.bound_device_fingerprint <> p_device_fingerprint then
    return query select false, v_license.id, v_license.status, v_license.expires_at, 'device is not authorized';
    return;
  end if;

  update public.ea_licenses
  set allowed_account = coalesce(allowed_account, p_account_number),
      bound_device_fingerprint = coalesce(bound_device_fingerprint, p_device_fingerprint),
      last_seen_at = now()
  where id = v_license.id;
  insert into public.ea_heartbeats(license_id, account_number, device_fingerprint, ea_version, telemetry)
  values (v_license.id, p_account_number, p_device_fingerprint, p_ea_version, coalesce(p_telemetry, '{}'::jsonb));
  return query select true, v_license.id, v_license.status, v_license.expires_at, 'ok';
end; $$;

revoke all on function public.validate_ea_license_by_activation(bigint, bigint, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.validate_ea_license_by_activation(bigint, bigint, text, text, text, jsonb) to service_role;
