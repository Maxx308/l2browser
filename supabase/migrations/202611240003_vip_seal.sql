begin;

alter table public.vip_trials
  add column if not exists chronicle_seal jsonb;

create or replace function public.sync_vip_seal(
  slot_index integer default null,
  entry_id integer default null,
  entry_time bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  earned boolean;
  placement jsonb;
begin
  if account_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if slot_index is not null or entry_id is not null or entry_time is not null then
    if slot_index is null or slot_index not between 0 and 4 or
       entry_id is null or entry_id < 1 or entry_time is null or entry_time < 1 then
      raise invalid_parameter_value using message = 'Invalid chronicle entry';
    end if;

    -- После первого успешного запроса остальные получают ту же отметку.
    update public.vip_trials
    set chronicle_seal = jsonb_build_object('slot', slot_index, 'entry', entry_id, 'at', entry_time)
    where user_id = account_id and extended_until is not null and chronicle_seal is null;
  end if;

  select extended_until is not null, chronicle_seal into earned, placement
  from public.vip_trials
  where user_id = account_id;

  return jsonb_build_object('earned', coalesce(earned, false), 'placement', placement);
end;
$$;

revoke all on function public.sync_vip_seal(integer, integer, bigint) from public, anon;
grant execute on function public.sync_vip_seal(integer, integer, bigint) to authenticated;

commit;
