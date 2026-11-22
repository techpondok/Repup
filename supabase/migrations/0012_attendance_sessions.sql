-- One check_ins row is one visit session. Existing rows remain intact.
alter table check_ins
  add column if not exists check_out_at timestamptz,
  add column if not exists duration_seconds integer,
  add column if not exists attendance_status text not null default 'completed',
  add column if not exists check_out_source text,
  add column if not exists check_out_device_id text,
  add column if not exists processed_by uuid references profiles(id),
  add column if not exists scheduled_auto_checkout_at timestamptz,
  add column if not exists checkout_note text;

create index if not exists idx_checkins_attendance_status on check_ins(branch_id, attendance_status, occurred_at desc);
create unique index if not exists idx_checkins_one_active_visit
  on check_ins(member_id, branch_id)
  where status = 'success' and attendance_status = 'active';

alter table gyms
  add column if not exists auto_checkout_mode text not null default 'off'
    check (auto_checkout_mode in ('off', 'maximum_duration', 'closing_time', 'both')),
  add column if not exists auto_checkout_max_minutes integer,
  add column if not exists auto_checkout_closing_time time,
  add column if not exists auto_checkout_grace_minutes integer not null default 15;

alter table gym_devices
  add column if not exists direction text not null default 'AUTO'
    check (direction in ('IN', 'OUT', 'AUTO'));

create or replace function process_attendance(
  p_member_id uuid,
  p_branch_id uuid,
  p_direction text default 'AUTO',
  p_method checkin_method default 'manual',
  p_source text default 'manual',
  p_device_id text default null
)
returns table (
  result_status checkin_status,
  result_action text,
  attendance_status text,
  denial_reason text,
  member_name text,
  plan_name text,
  valid_until date,
  branch_name text,
  attendance_id uuid,
  check_in_at timestamptz,
  check_out_at timestamptz,
  duration_seconds integer
) as $$
declare
  v_active record;
  v_member record;
  v_validation record;
  v_plan_name text;
  v_branch_name text;
  v_now timestamptz := now();
  v_max_minutes integer;
  v_auto_close timestamptz;
  v_closing_time time;
  v_timezone text;
  v_direction text := upper(coalesce(p_direction, 'AUTO'));
  v_attendance_id uuid;
begin
  if not has_branch_access(p_branch_id) then
    raise exception 'Not authorized for this branch';
  end if;
  if v_direction not in ('IN', 'OUT', 'AUTO') then
    raise exception 'Invalid attendance direction';
  end if;

  -- Serialize scans for the same member/branch so two devices cannot open two visits.
  perform pg_advisory_xact_lock(hashtextextended(p_member_id::text || ':' || p_branch_id::text, 0));

  select c.* into v_active
  from check_ins c
  where c.member_id = p_member_id and c.branch_id = p_branch_id
    and c.status = 'success' and c.attendance_status = 'active'
  order by c.occurred_at desc
  limit 1
  for update;

  select m.full_name into v_member from members m where m.id = p_member_id and m.branch_id = p_branch_id;
  select b.name into v_branch_name from branches b where b.id = p_branch_id;
  if v_member is null then
    return query select 'denied'::checkin_status, 'not_found', null::text, 'Member tidak ditemukan di cabang ini.', null::text, null::text, null::date, v_branch_name, null::uuid, null::timestamptz, null::timestamptz, null::integer;
    return;
  end if;

  if v_active is not null and v_direction in ('OUT', 'AUTO') then
    update check_ins set
      check_out_at = v_now,
      duration_seconds = greatest(0, extract(epoch from (v_now - occurred_at))::integer),
      attendance_status = case when p_source = 'staff' then 'manual_checkout' else 'completed' end,
      check_out_source = p_source,
      check_out_device_id = p_device_id,
      processed_by = case when p_source = 'staff' then auth.uid() else null end
    where id = v_active.id;
    return query select 'success'::checkin_status, 'check_out', (case when p_source = 'staff' then 'manual_checkout' else 'completed' end), null::text, v_member.full_name, null::text, null::date, v_branch_name, v_active.id, v_active.occurred_at, v_now, greatest(0, extract(epoch from (v_now - v_active.occurred_at))::integer);
    return;
  end if;

  if v_active is not null and v_direction = 'IN' then
    select mp.name into v_plan_name from memberships ms join membership_plans mp on mp.id = ms.membership_plan_id where ms.id = v_active.membership_id;
    return query select 'success'::checkin_status, 'already_inside', 'active', 'Member sudah check-in dan masih berada di gym.', v_member.full_name, v_plan_name, null::date, v_branch_name, v_active.id, v_active.occurred_at, null::timestamptz, greatest(0, extract(epoch from (v_now - v_active.occurred_at))::integer);
    return;
  end if;

  if v_active is null and v_direction = 'OUT' then
    return query select 'denied'::checkin_status, 'no_active_visit', null::text, 'Member belum memiliki check-in aktif.', v_member.full_name, null::text, null::date, v_branch_name, null::uuid, null::timestamptz, null::timestamptz, null::integer;
    return;
  end if;

  -- A completed visit is no longer a duplicate active visit. Debounce is enforced
  -- by the active-session lock/index instead of the legacy check-in window.
  select * into v_validation from perform_check_in(p_member_id, p_branch_id, p_method, 0) limit 1;
  if v_validation.result_status <> 'success' then
    return query select v_validation.result_status, 'denied', null::text, v_validation.denial_reason, v_validation.member_name, v_validation.plan_name, v_validation.valid_until, v_validation.branch_name, null::uuid, null::timestamptz, null::timestamptz, null::integer;
    return;
  end if;

  select g.auto_checkout_mode, g.auto_checkout_max_minutes, g.auto_checkout_closing_time, g.timezone into v_direction, v_max_minutes, v_closing_time, v_timezone from branches b join gyms g on g.id = b.gym_id where b.id = p_branch_id;
  if v_direction in ('maximum_duration', 'both') and v_max_minutes is not null then
    v_auto_close := v_now + (v_max_minutes || ' minutes')::interval;
  end if;
  if v_direction in ('closing_time', 'both') and v_closing_time is not null then
    v_auto_close := (current_date + v_closing_time) at time zone coalesce(v_timezone, 'Asia/Jakarta');
    if v_auto_close <= v_now then
      v_auto_close := ((current_date + 1) + v_closing_time) at time zone coalesce(v_timezone, 'Asia/Jakarta');
    end if;
    if v_direction = 'both' and v_max_minutes is not null then
      v_auto_close := least(v_auto_close, v_now + (v_max_minutes || ' minutes')::interval);
    end if;
  end if;
  select c.id into v_attendance_id from check_ins c where c.member_id = p_member_id and c.branch_id = p_branch_id order by c.occurred_at desc limit 1;
  update check_ins set attendance_status = 'active', source = p_source, device_id = p_device_id, scheduled_auto_checkout_at = v_auto_close where id = v_attendance_id;
  return query select v_validation.result_status, 'check_in', 'active', null::text, v_validation.member_name, v_validation.plan_name, v_validation.valid_until, v_validation.branch_name, v_attendance_id, v_now, null::timestamptz, null::integer;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function auto_close_attendance_sessions()
returns integer as $$
declare v_count integer;
begin
  update check_ins set
    check_out_at = least(now(), coalesce(scheduled_auto_checkout_at, now())),
    duration_seconds = greatest(0, extract(epoch from (least(now(), coalesce(scheduled_auto_checkout_at, now())) - occurred_at))::integer),
    attendance_status = 'auto_closed',
    check_out_source = 'auto'
  where status = 'success' and attendance_status = 'active'
    and scheduled_auto_checkout_at is not null and scheduled_auto_checkout_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public;
