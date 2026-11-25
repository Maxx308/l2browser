create table if not exists public.vip_trials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.vip_trials enable row level security;
revoke all on public.vip_trials from public, anon, authenticated;

create or replace function public.claim_vip_trial()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  expiry timestamptz;
begin
  if account_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  insert into public.vip_trials (user_id)
  values (account_id)
  on conflict (user_id) do nothing;

  select started_at + interval '720 hours' into expiry
  from public.vip_trials
  where user_id = account_id;

  return (extract(epoch from expiry) * 1000)::bigint;
end;
$$;

revoke all on function public.claim_vip_trial() from public, anon;
grant execute on function public.claim_vip_trial() to authenticated;
