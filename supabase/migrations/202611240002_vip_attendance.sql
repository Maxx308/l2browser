begin;

alter table public.vip_trials
  add column if not exists extended_until timestamptz,
  add column if not exists last_visit date,
  add column if not exists visit_count smallint not null default 0
    check (visit_count between 0 and 15);

create or replace function public.sync_vip(check_in boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  trial public.vip_trials%rowtype;
  checked_at timestamptz;
  today date;
  first_day date;
  period_start date;
  expiry timestamptz;
  visits smallint;
  renewed boolean := false;
begin
  if account_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  insert into public.vip_trials (user_id)
  values (account_id)
  on conflict (user_id) do nothing;

  -- Счётчик и награда меняются под одной блокировкой аккаунта.
  select * into trial from public.vip_trials
  where user_id = account_id
  for update;

  checked_at := clock_timestamp();
  today := (checked_at at time zone 'Europe/Moscow')::date;
  first_day := (trial.started_at at time zone 'Europe/Moscow')::date;
  period_start := first_day + (greatest(today - first_day, 0) / 30) * 30;
  expiry := coalesce(trial.extended_until, trial.started_at + interval '720 hours');
  visits := case when trial.last_visit >= period_start then trial.visit_count else 0 end;

  if check_in and (trial.last_visit is null or trial.last_visit < today) then
    renewed := visits = 14;
    visits := least(visits + 1, 15);
    if renewed then
      expiry := greatest(expiry, checked_at) + interval '720 hours';
      trial.extended_until := expiry;
    end if;
    trial.last_visit := today;

    update public.vip_trials
    set last_visit = trial.last_visit,
        visit_count = visits,
        extended_until = trial.extended_until
    where user_id = account_id;
  end if;

  return jsonb_build_object(
    'expiry', (extract(epoch from expiry) * 1000)::bigint,
    'days', visits,
    'period_end', period_start + 29 - date '1970-01-01',
    'checked_in', coalesce(trial.last_visit = today, false),
    'renewed', renewed
  );
end;
$$;

revoke all on function public.sync_vip(boolean) from public, anon;
grant execute on function public.sync_vip(boolean) to authenticated;

-- Старый клиент по-прежнему читает действительный срок VIP.
create or replace function public.claim_vip_trial()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  return (public.sync_vip(false) ->> 'expiry')::bigint;
end;
$$;

revoke all on function public.claim_vip_trial() from public, anon;
grant execute on function public.claim_vip_trial() to authenticated;

commit;
