alter table public.gyms add column if not exists pt_booking_settings jsonb not null default '{}'::jsonb;
alter table public.membership_plans add column if not exists pt_session_duration integer check (pt_session_duration in (30,45,60,90));
create sequence if not exists public.pt_booking_reference_seq;
alter table public.pt_client_assignments add column if not exists session_duration integer check (session_duration in (30,45,60,90));
update public.pt_client_assignments a set session_duration=coalesce(
  (select p.pt_session_duration from public.membership_plans p where p.id=a.package_plan_id),t.session_duration,60)
from public.trainers t where t.id=a.trainer_id and a.session_duration is null;
alter table public.pt_sessions
  add column if not exists assigned_trainer_id uuid references public.trainers(id),
  add column if not exists booking_reference text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists approval_expires_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid references public.profiles(id),
  add column if not exists cancelled_at timestamptz;
update public.pt_sessions set assigned_trainer_id=trainer_id where assigned_trainer_id is null;
alter table public.pt_sessions alter column booking_reference set default ('PT-'||nextval('public.pt_booking_reference_seq')::text);
update public.pt_sessions set booking_reference=default where booking_reference is null;
alter table public.pt_sessions alter column booking_reference set not null;
create unique index if not exists pt_booking_reference_unique on public.pt_sessions(booking_reference);
alter table public.pt_sessions alter column assigned_trainer_id set not null;
alter table public.pt_sessions drop constraint pt_sessions_status_check,
  add constraint pt_sessions_status_check check (status in ('scheduled','pending_approval','confirmed','completed','no_show','cancelled','rejected','expired')),
  add constraint pt_pending_has_expiry check (status <> 'pending_approval' or approval_expires_at is not null);

create index if not exists idx_pt_sessions_pending_expiry on public.pt_sessions(approval_expires_at) where status='pending_approval';
create index if not exists idx_pt_sessions_pending_trainer on public.pt_sessions(trainer_id,scheduled_at) where status='pending_approval';
create index if not exists idx_pt_sessions_pending_member on public.pt_sessions(member_id,scheduled_at) where status='pending_approval';
create index if not exists idx_pt_audit_entity on public.audit_logs(entity_type,entity_id,created_at);

create table public.pt_trainer_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  assignment_id uuid not null references public.pt_client_assignments(id),
  current_trainer_id uuid not null references public.trainers(id),
  preferred_trainer_id uuid references public.trainers(id),
  reason text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  review_reason text,
  created_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.pt_trainer_change_requests enable row level security;
create unique index pt_change_one_pending on public.pt_trainer_change_requests(assignment_id) where status='pending';

create or replace function public.protect_pt_audit_entries()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('authenticated','anon') then
    raise exception 'PT history entries must come from the booking workflow';
  end if;
  return new;
end;
$$;
create trigger protect_pt_audit_entries before insert on public.audit_logs
for each row when (new.entity_type in ('pt_session','pt_assignment')) execute function public.protect_pt_audit_entries();

create or replace function public.protect_pt_assignment_scope()
returns trigger language plpgsql set search_path='' as $$
declare scope_gym uuid; plan_duration int;
begin
  if tg_op='UPDATE' then
    if (new.organization_id,new.location_id,new.member_id,new.package_plan_id,new.session_duration) is distinct from
       (old.organization_id,old.location_id,old.member_id,old.package_plan_id,old.session_duration) then
      raise exception 'The purchased PT assignment cannot change scope, package, or duration';
    end if;
    if current_user in ('authenticated','anon') and (new.trainer_id,new.sessions_total,new.sessions_used) is distinct from
      (old.trainer_id,old.sessions_total,old.sessions_used) then
      raise exception 'Use the authorized PT workflow to change trainer or quota';
    end if;
    if new.trainer_id is not distinct from old.trainer_id then return new; end if;
  end if;
  select gym_id into scope_gym from public.branches where id=new.location_id and organization_id=new.organization_id;
  if scope_gym is null or not exists (
    select 1 from public.members m where m.id=new.member_id and m.organization_id=new.organization_id and m.gym_id=scope_gym
      and m.status<>'archived'
  ) or not exists (
    select 1 from public.trainers t join public.trainer_roles r on r.trainer_id=t.id and r.role='TRAINER'
    where t.id=new.trainer_id and t.organization_id=new.organization_id and t.gym_id=scope_gym and t.archived_at is null
      and t.is_active and coalesce(t.trainer_status,'active')='active'
  ) then raise exception 'Member, trainer and location must belong to this gym'; end if;
  if tg_op='INSERT' then
    if exists(select 1 from public.membership_plans p where p.id=new.package_plan_id and p.organization_id=new.organization_id
      and p.gym_id=scope_gym and p.is_active and p.archived_at is null) then
      select p.pt_session_duration into plan_duration from public.membership_plans p where p.id=new.package_plan_id;
    else raise exception 'Choose a valid PT plan from this gym'; end if;
    new.session_duration:=coalesce(plan_duration,new.session_duration,
      (select t.session_duration from public.trainers t where t.id=new.trainer_id),60);
  end if;
  return new;
end;
$$;
create trigger protect_pt_assignment_scope before insert or update on public.pt_client_assignments
for each row execute function public.protect_pt_assignment_scope();

create or replace function public.pt_config(raw jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select '{"confirmation":"auto","approvalMinutes":120,"intervalMinutes":30,"bufferMinutes":0,"noticeMinutes":60,"advanceDays":30,"lateCancelHours":12,"chargeLateCancel":false,"chargeNoShow":false}'::jsonb || raw;
$$;

create or replace function public.pt_open(p_status text,p_expiry timestamptz)
returns boolean language sql stable set search_path='' as $$
  select p_status in ('scheduled','confirmed') or (p_status='pending_approval' and p_expiry>now());
$$;

create or replace function public.pt_admin(p_org uuid,p_branch uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_users u where u.organization_id=p_org and u.user_id=auth.uid()
    and u.role in ('owner','admin') and u.status='active') and (p_branch is null or public.has_branch_access(p_branch));
$$;

create or replace function public.pt_actor(p_org uuid,p_branch uuid,p_member uuid,p_trainer uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when public.pt_admin(p_org,p_branch) then 'admin'
    when public.has_branch_access(p_branch) and exists (
      select 1 from public.trainers t join public.organization_users u on u.organization_id=t.organization_id and u.user_id=t.user_id
      where t.id=p_trainer and t.user_id=auth.uid() and t.organization_id=p_org and u.status='active' and u.role in ('trainer','coach')
    ) then 'trainer'
    when exists(select 1 from public.members m where m.id=p_member and m.organization_id=p_org and m.repup_account_id=auth.uid() and m.status <> 'archived') then 'member'
  end;
$$;

create or replace function public.pt_counts(p_assignment uuid)
returns table(completed integer, reserved integer)
language sql stable set search_path='' as $$
  select greatest(a.sessions_used, count(*) filter (where s.status='completed' or s.session_credit_consumed)::integer),
    count(*) filter (where public.pt_open(s.status,s.approval_expires_at))::integer
  from public.pt_client_assignments a left join public.pt_sessions s on s.pt_client_assignment_id=a.id
  where a.id=p_assignment group by a.sessions_used;
$$;

create or replace function public.trainer_slot_allowed(p_availability jsonb,p_date date,p_start time,p_end time)
returns boolean language sql immutable set search_path='' as $$
  select p_availability is not null and (
    not exists (
      select 1 from jsonb_array_elements(p_availability->'timeOff') o
      where (p_date+p_start) < coalesce(nullif(o->>'endDate',''),o->>'date')::date + coalesce(nullif(o->>'endTime','')::time,'24:00'::time)
        and (o->>'date')::date + coalesce(nullif(o->>'startTime','')::time,'00:00'::time) < (p_date+p_end)
    )
    and exists (
      select 1 from jsonb_array_elements(p_availability->'weekly') w where (w->>'day')::integer=extract(isodow from p_date)
        and w->>'kind'='available' and (w->>'start')::time<=p_start and (w->>'end')::time>=p_end
    )
    and not exists (
      select 1 from jsonb_array_elements(p_availability->'weekly') w where (w->>'day')::integer=extract(isodow from p_date)
        and w->>'kind'='break' and (w->>'start')::time<p_end and p_start<(w->>'end')::time
    )
  );
$$;

create or replace function public.pt_slot_error(
  a public.pt_client_assignments,t public.trainers,p_at timestamptz,p_duration integer,p_skip uuid,p_check_window boolean
) returns text language plpgsql stable set search_path='' as $$
declare
  g public.gyms%rowtype;
  b public.branches%rowtype;
  cfg jsonb;
  local_start timestamp;
  local_finish timestamp;
  windows jsonb;
  dow text;
  buffer interval;
begin
  select * into b from public.branches where id=a.location_id and organization_id=a.organization_id and status='active';
  select * into g from public.gyms where id=b.gym_id and organization_id=a.organization_id and archived_at is null;
  if g.id is null or t.gym_id is distinct from g.id or t.organization_id is distinct from a.organization_id
     or not t.is_active or t.archived_at is not null or coalesce(t.trainer_status,'active')<>'active' then
    return 'Trainer is unavailable during this time. Please choose another available slot.';
  end if;
  cfg := public.pt_config(g.pt_booking_settings);
  buffer := make_interval(mins => (cfg->>'bufferMinutes')::integer);
  local_start := p_at at time zone g.timezone;
  local_finish := (p_at + make_interval(mins => p_duration)) at time zone g.timezone;
  if p_duration not between 15 and 180 or local_finish::date <> local_start::date or local_finish<=local_start then return 'Invalid session time range.'; end if;
  if a.status<>'active' or local_start::date<a.start_date or (a.end_date is not null and local_start::date>a.end_date) then
    return 'This PT package is inactive or outside its validity dates.';
  end if;
  if p_check_window and (
    p_at < now()+make_interval(mins => (cfg->>'noticeMinutes')::integer)
    or local_start::date>(now() at time zone g.timezone)::date + (cfg->>'advanceDays')::integer
    or extract(second from local_start)<>0
    or (extract(hour from local_start)::int*60+extract(minute from local_start)::int) % (cfg->>'intervalMinutes')::int<>0
  ) then return 'Choose a slot within the gym booking window.'; end if;
  dow := extract(isodow from local_start)::int::text;
  windows := coalesce(b.opening_hours->dow,b.opening_hours->lower(to_char(local_start,'FMDay')));
  if b.opening_hours<>'{}'::jsonb and (
    jsonb_typeof(windows) is distinct from 'array' or not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(windows)='array' then windows else '[]'::jsonb end) w
      where (w->>'start')::time<=local_start::time and (w->>'end')::time>=local_finish::time
    )
  ) then return 'The gym is closed during this time.'; end if;
  if not public.trainer_slot_allowed(t.availability,local_start::date,local_start::time,local_finish::time) then
    return 'Trainer is unavailable during this time. Please choose another available slot.';
  end if;
  if exists (
    select 1 from public.pt_sessions s where s.trainer_id=t.id and s.id is distinct from p_skip
      and public.pt_open(s.status,s.approval_expires_at)
      and s.scheduled_at < p_at + make_interval(mins => p_duration) + buffer
      and p_at < s.scheduled_at + make_interval(mins => s.duration_minutes) + buffer
  ) then return 'Trainer already has a scheduled session during this time. Please choose another available slot.'; end if;
  if exists (
    select 1 from public.pt_sessions s where s.member_id=a.member_id and s.id is distinct from p_skip
      and public.pt_open(s.status,s.approval_expires_at)
      and s.scheduled_at < p_at + make_interval(mins => p_duration)
      and p_at < s.scheduled_at + make_interval(mins => s.duration_minutes)
  ) then return 'Member tidak tersedia pada waktu tersebut.'; end if;
  return null;
end;
$$;

create or replace function public.protect_pt_session_schedule()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  a public.pt_client_assignments%rowtype;
  t public.trainers%rowtype;
  g public.gyms%rowtype;
  affected boolean;
  add_credit boolean;
  completed integer;
  reserved integer;
  new_local timestamp;
  err text;
  action text;
begin
  if tg_op='UPDATE' and (
    (new.organization_id,new.location_id,new.member_id,new.pt_client_assignment_id,new.assigned_trainer_id) is distinct from
    (old.organization_id,old.location_id,old.member_id,old.pt_client_assignment_id,old.assigned_trainer_id)
  ) then raise exception 'The PT session assignment cannot change'; end if;

  update public.pt_client_assignments x set sessions_used=x.sessions_used where x.id=new.pt_client_assignment_id returning x.* into a;
  if not found or (a.organization_id,a.location_id,a.member_id) is distinct from (new.organization_id,new.location_id,new.member_id)
    then raise exception 'The PT session assignment is invalid'; end if;
  if tg_op='INSERT' and (new.trainer_id<>a.trainer_id or new.assigned_trainer_id<>a.trainer_id) then
    raise exception 'The booking must use the package trainer';
  end if;
  select g0.* into g from public.gyms g0 join public.branches b on b.gym_id=g0.id where b.id=a.location_id;
  new_local := new.scheduled_at at time zone g.timezone;
  new.session_date := new_local::date;
  new.start_time := new_local::time;
  new.end_time := ((new.scheduled_at+make_interval(mins=>new.duration_minutes)) at time zone g.timezone)::time;
  affected := tg_op='INSERT' or (new.scheduled_at,new.duration_minutes,new.trainer_id) is distinct from (old.scheduled_at,old.duration_minutes,old.trainer_id);
  if tg_op='UPDATE' and (affected or new.status is distinct from old.status) and old.status not in ('scheduled','confirmed','pending_approval') then
    raise exception 'Only open bookings can be changed';
  end if;
  if tg_op='UPDATE' and old.status='pending_approval' and old.approval_expires_at<=now() and new.status<>'expired' then
    raise exception 'This booking has expired.';
  end if;
  if (affected or (tg_op='UPDATE' and old.status='pending_approval' and new.status='confirmed'))
     and public.pt_open(new.status,new.approval_expires_at) then
    perform pg_advisory_xact_lock(hashtextextended('pt_member:'||new.member_id::text,0));
    update public.trainers x set availability=x.availability where x.id=new.trainer_id returning x.* into t;
    err := public.pt_slot_error(a,t,new.scheduled_at,new.duration_minutes,new.id,
      tg_op='INSERT' or new.scheduled_at is distinct from old.scheduled_at);
    if err is not null then raise exception '%',err; end if;
  end if;
  if tg_op='INSERT' and public.pt_open(new.status,new.approval_expires_at) then
    select c.completed,c.reserved into completed,reserved from public.pt_counts(a.id) c;
    if completed+reserved>=a.sessions_total then raise exception 'No PT sessions remain available.'; end if;
  end if;
  add_credit := coalesce(new.session_credit_consumed,false) or new.status='completed';
  if tg_op='UPDATE' and add_credit and not old.session_credit_consumed then
    select c.completed into completed from public.pt_counts(a.id) c;
    update public.pt_client_assignments set sessions_used=least(sessions_total,completed+1) where id=a.id;
    new.session_credit_consumed := true;
  end if;
  if tg_op='UPDATE' and (affected or new.status is distinct from old.status) then
    action := case when new.trainer_id<>old.trainer_id then 'pt_session.trainer_replaced'
      when new.status is distinct from old.status then 'pt_session.'||new.status else 'pt_session.rescheduled' end;
    insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values(new.organization_id,auth.uid(),action,'pt_session',new.id,
      jsonb_build_object('reason',coalesce(new.schedule_change_reason,''),'previous_start',old.scheduled_at,'new_start',new.scheduled_at,
        'previous_status',old.status,'new_status',new.status,'previous_trainer',old.trainer_id,'new_trainer',new.trainer_id,
        'member_id',new.member_id,'assignment_id',new.pt_client_assignment_id,'previous_duration',old.duration_minutes,'new_duration',new.duration_minutes));
  end if;
  new.schedule_change_reason:=null;
  return new;
end;
$$;

revoke insert,update,delete on public.pt_sessions from public,anon,authenticated;

create or replace function public.pt_available_slots(p_assignment uuid,p_date date,p_session uuid default null,p_candidate uuid default null)
returns text[] language plpgsql stable security definer set search_path='' as $$
declare
  a public.pt_client_assignments%rowtype;
  s public.pt_sessions%rowtype;
  t public.trainers%rowtype;
  g public.gyms%rowtype;
  cfg jsonb;
  duration int;
  clock_at timestamp;
  out_slots text[]:='{}';
  n integer;
begin
  select * into a from public.pt_client_assignments where id=p_assignment;
  if p_session is not null then
    select * into s from public.pt_sessions where id=p_session and pt_client_assignment_id=p_assignment;
    if not found or not public.pt_open(s.status,s.approval_expires_at) then raise exception 'Booking unavailable.'; end if;
  end if;
  if a.id is null or public.pt_actor(a.organization_id,a.location_id,a.member_id,coalesce(s.trainer_id,a.trainer_id)) is null then
    raise exception 'PT assignment unavailable.';
  end if;
  if p_candidate is not null and not public.pt_admin(a.organization_id,a.location_id) then raise exception 'PT assignment unavailable.'; end if;
  select * into t from public.trainers where id=coalesce(p_candidate,s.trainer_id,a.trainer_id);
  select g0.* into g from public.gyms g0 join public.branches b on b.gym_id=g0.id where b.id=a.location_id;
  cfg:=public.pt_config(g.pt_booking_settings);
  select p.pt_session_duration into duration from public.membership_plans p where p.id=a.package_plan_id;
  duration:=coalesce(s.duration_minutes,a.session_duration,duration,t.session_duration,60);
  if p_session is null and p_candidate is null and exists(select 1 from public.pt_counts(a.id) c where c.completed+c.reserved>=a.sessions_total)
    then return out_slots; end if;
  for n in 0..1439 by (cfg->>'intervalMinutes')::integer loop
    clock_at:=p_date+make_interval(mins=>n);
    if ((clock_at at time zone g.timezone) at time zone g.timezone)=clock_at
       and public.pt_slot_error(a,t,clock_at at time zone g.timezone,duration,p_session,
         p_candidate is null or p_session is null or (clock_at at time zone g.timezone) is distinct from s.scheduled_at) is null then
      out_slots:=array_append(out_slots,to_char(clock_at,'HH24:MI'));
    end if;
  end loop;
  return out_slots;
end;
$$;

create or replace function public.pt_create_booking(p_assignment uuid,p_date date,p_time time)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  a public.pt_client_assignments%rowtype;
  t public.trainers%rowtype;
  g public.gyms%rowtype;
  cfg jsonb;
  id_out uuid;
  duration int;
  state text;
  starts timestamptz;
begin
  select * into a from public.pt_client_assignments where id=p_assignment;
  if a.id is null or public.pt_actor(a.organization_id,a.location_id,a.member_id,a.trainer_id) is null then raise exception 'PT assignment unavailable.'; end if;
  update public.pt_client_assignments x set sessions_used=x.sessions_used where x.id=a.id returning x.* into a;
  select * into t from public.trainers where id=a.trainer_id;
  select g0.* into g from public.gyms g0 join public.branches b on b.gym_id=g0.id where b.id=a.location_id;
  cfg:=public.pt_config(g.pt_booking_settings);
  select p.pt_session_duration into duration from public.membership_plans p where p.id=a.package_plan_id;
  duration:=coalesce(a.session_duration,duration,t.session_duration,60);
  starts:=(p_date+p_time) at time zone g.timezone;
  if starts is null or starts<=now() or (starts at time zone g.timezone) is distinct from p_date+p_time then
    raise exception 'Choose a valid future start time.';
  end if;
  state:=case when cfg->>'confirmation'='approval' then 'pending_approval' else 'confirmed' end;
  insert into public.pt_sessions(organization_id,location_id,pt_client_assignment_id,member_id,trainer_id,assigned_trainer_id,
    scheduled_at,duration_minutes,session_date,start_time,end_time,status,created_by,approval_expires_at)
  values(a.organization_id,a.location_id,a.id,a.member_id,t.id,t.id,starts,duration,p_date,p_time,p_time,state,auth.uid(),
    case when state='pending_approval' then least(starts,now()+make_interval(mins=>(cfg->>'approvalMinutes')::integer)) end)
  returning id into id_out;
  return id_out;
end;
$$;

create or replace function public.pt_change_booking(p_id uuid,p_operation text,p_date date,p_time time,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  s public.pt_sessions%rowtype;
  g public.gyms%rowtype;
  cfg jsonb;
  actor text;
  state text;
  new_at timestamptz;
  reason text:=nullif(trim(p_reason),'');
begin
  select * into s from public.pt_sessions where id=p_id for update;
  if s.id is null then raise exception 'Booking unavailable.'; end if;
  actor:=public.pt_actor(s.organization_id,s.location_id,s.member_id,s.trainer_id);
  if actor is null and p_operation in ('approve','reject') then actor:=public.pt_actor(s.organization_id,s.location_id,s.member_id,s.assigned_trainer_id); end if;
  if actor is null then raise exception 'Booking unavailable.'; end if;
  if not public.pt_open(s.status,s.approval_expires_at) then raise exception 'Only open bookings can be changed.'; end if;
  if reason is not null and length(reason)>300 then raise exception 'Enter a reason up to 300 characters.'; end if;
  select g0.* into g from public.gyms g0 join public.branches b on b.gym_id=g0.id where b.id=s.location_id;
  cfg:=public.pt_config(g.pt_booking_settings);
  if p_operation='reschedule' then
    if reason is null or p_date is null or p_time is null then raise exception 'Enter a valid schedule and reason.'; end if;
    if actor='member' and s.scheduled_at<=now() then raise exception 'This booking has already started.'; end if;
    new_at:=(p_date+p_time) at time zone g.timezone;
    if new_at<=now() or (new_at at time zone g.timezone) is distinct from p_date+p_time then raise exception 'Choose a valid future start time.'; end if;
    if new_at=s.scheduled_at then raise exception 'Choose a different schedule.'; end if;
    update public.pt_sessions set scheduled_at=new_at,schedule_change_reason=reason,updated_at=now(),
      approval_expires_at=case when s.status='pending_approval' then least(new_at,now()+make_interval(mins=>(cfg->>'approvalMinutes')::integer)) else s.approval_expires_at end
      where id=p_id;
    return p_id;
  end if;
  if p_operation='cancel' then
    if reason is null then raise exception 'Enter a cancellation reason.'; end if;
    if actor='member' and s.scheduled_at<=now() then raise exception 'This booking has already started.'; end if;
    state:='cancelled';
  elsif actor='member' then raise exception 'Only staff can perform this action.';
  elsif p_operation in ('approve','reject') and s.status='pending_approval' then
    if p_operation='reject' and reason is null then raise exception 'Enter a rejection reason.'; end if;
    state:=case when p_operation='approve' then 'confirmed' else 'rejected' end;
  elsif p_operation in ('complete','no_show') and s.status in ('confirmed','scheduled') and s.scheduled_at<=now() then
    state:=case when p_operation='complete' then 'completed' else 'no_show' end;
  else raise exception 'This booking cannot be changed to the selected status.';
  end if;
  update public.pt_sessions set status=state,schedule_change_reason=reason,updated_at=now(),
    cancelled_at=case when state='cancelled' then now() else cancelled_at end,
    cancelled_by=case when state='cancelled' then auth.uid() else cancelled_by end,
    cancellation_reason=case when state='cancelled' then reason else cancellation_reason end,
    session_credit_consumed=state='completed' or (state='no_show' and (cfg->>'chargeNoShow')::boolean)
      or (state='cancelled' and actor='member' and s.status<>'pending_approval' and (cfg->>'chargeLateCancel')::boolean
        and s.scheduled_at-now()<make_interval(hours=>(cfg->>'lateCancelHours')::integer))
    where id=p_id;
  return p_id;
end;
$$;

create or replace function public.expire_pt_pending_bookings()
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.pt_sessions set status='expired',updated_at=now()
  where status='pending_approval' and approval_expires_at<=now();
  get diagnostics changed=row_count;
  return changed;
end;
$$;

do $$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron';
    if not exists(select 1 from cron.job where jobname='repup-pt-pending-expiry') then
      perform cron.schedule('repup-pt-pending-expiry','* * * * *','select public.expire_pt_pending_bookings()');
    end if;
  end if;
end;
$$;

create or replace function public.pt_replace_trainer(p_assignment uuid,p_session uuid,p_trainer uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  a public.pt_client_assignments%rowtype;
  s public.pt_sessions%rowtype;
  reason text:=nullif(trim(p_reason),'');
begin
  -- Lock the session first, matching other booking mutations.
  if p_session is not null then select * into s from public.pt_sessions where id=p_session and pt_client_assignment_id=p_assignment for update; end if;
  select * into a from public.pt_client_assignments where id=p_assignment for update;
  if a.id is null or not public.pt_admin(a.organization_id,a.location_id) then raise exception 'PT assignment unavailable.'; end if;
  if reason is null or length(reason)>300 then raise exception 'Enter a replacement reason up to 300 characters.'; end if;
  if not exists (
    select 1 from public.trainers t join public.branches b on b.id=a.location_id and b.gym_id=t.gym_id
    join public.trainer_roles r on r.trainer_id=t.id and r.role='TRAINER'
    where t.id=p_trainer and t.organization_id=a.organization_id and t.is_active and t.archived_at is null
      and coalesce(t.trainer_status,'active')='active'
  ) then raise exception 'Choose an active replacement trainer from this gym.'; end if;
  if p_session is null then
    if p_trainer=a.trainer_id then raise exception 'Choose a different trainer.'; end if;
    update public.pt_client_assignments set trainer_id=p_trainer,updated_at=now() where id=a.id;
    insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values(a.organization_id,auth.uid(),'pt_assignment.trainer_replaced','pt_assignment',a.id,
      jsonb_build_object('reason',reason,'previous_trainer',a.trainer_id,'new_trainer',p_trainer,
        'member_id',a.member_id,'package_id',a.package_plan_id,'change_type','permanent'));
    return a.id;
  end if;
  if s.id is null or s.scheduled_at<=now() or not public.pt_open(s.status,s.approval_expires_at) then
    raise exception 'Only upcoming open bookings can be reassigned.';
  end if;
  if s.trainer_id=p_trainer then raise exception 'Choose a different trainer.'; end if;
  update public.pt_sessions set trainer_id=p_trainer,schedule_change_reason=reason,updated_at=now() where id=s.id;
  return s.id;
end;
$$;

create or replace function public.pt_request_trainer_change(p_assignment uuid,p_reason text,p_preferred uuid,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  a public.pt_client_assignments%rowtype;
  request_id uuid;
  reason text:=replace(lower(trim(p_reason)),'_',' ');
begin
  select * into a from public.pt_client_assignments where id=p_assignment;
  if a.id is null or a.status<>'active' or not exists (
    select 1 from public.members m where m.id=a.member_id and m.organization_id=a.organization_id and m.repup_account_id=auth.uid() and m.status<>'archived'
  ) then raise exception 'PT assignment unavailable.'; end if;
  if reason is null or reason not in ('schedule conflict','trainer unavailable','personal preference','other')
     or length(coalesce(p_notes,''))>500 then raise exception 'Select a reason and use no more than 500 characters for notes.'; end if;
  if p_preferred is not null and not exists (
    select 1 from public.trainers t join public.branches b on b.id=a.location_id and b.gym_id=t.gym_id
    where t.id=p_preferred and t.organization_id=a.organization_id and t.id<>a.trainer_id and t.is_active and t.archived_at is null
      and coalesce(t.trainer_status,'active')='active'
  ) then raise exception 'Choose an active trainer from this gym.'; end if;
  insert into public.pt_trainer_change_requests(organization_id,assignment_id,current_trainer_id,preferred_trainer_id,reason,notes,created_by)
  values(a.organization_id,a.id,a.trainer_id,p_preferred,reason,nullif(trim(p_notes),''),auth.uid()) returning id into request_id;
  return request_id;
exception when unique_violation then raise exception 'A trainer change request is already pending for this package.';
end;
$$;

create or replace function public.pt_review_trainer_change(p_request uuid,p_decision text,p_trainer uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  r public.pt_trainer_change_requests%rowtype;
  a public.pt_client_assignments%rowtype;
begin
  select * into r from public.pt_trainer_change_requests where id=p_request for update;
  select * into a from public.pt_client_assignments where id=r.assignment_id for update;
  if a.id is null or r.status<>'pending' or p_decision not in ('approved','rejected')
     or not public.pt_admin(a.organization_id,a.location_id) then raise exception 'Trainer change request unavailable.'; end if;
  if length(coalesce(p_reason,''))>300 then raise exception 'Enter a review reason up to 300 characters.'; end if;
  if p_decision='approved' then
    if a.trainer_id<>r.current_trainer_id then raise exception 'The assigned trainer has changed. Review the current assignment first.'; end if;
    perform public.pt_replace_trainer(a.id,null,coalesce(p_trainer,r.preferred_trainer_id),coalesce(nullif(trim(p_reason),''),r.reason));
  end if;
  update public.pt_trainer_change_requests set status=p_decision,review_reason=nullif(trim(p_reason),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_request;
  return p_request;
end;
$$;

create or replace function public.pt_read_settings(p_org uuid,p_gym uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select public.pt_config(g.pt_booking_settings) from public.gyms g
  where g.id=p_gym and g.organization_id=p_org and public.pt_admin(p_org,null);
$$;

create or replace function public.pt_write_settings(p_org uuid,p_gym uuid,p_settings jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not public.pt_admin(p_org,null) then raise exception 'Only gym administrators can change PT settings.'; end if;
  if coalesce(p_settings->>'confirmation','') not in ('auto','approval')
     or coalesce((p_settings->>'approvalMinutes')::int,0) not between 1 and 10080
     or coalesce((p_settings->>'intervalMinutes')::int,0) not in (15,30,45,60)
     or coalesce((p_settings->>'bufferMinutes')::int,-1) not between 0 and 120
     or coalesce((p_settings->>'noticeMinutes')::int,-1) not between 0 and 10080
     or coalesce((p_settings->>'advanceDays')::int,0) not between 1 and 365
     or coalesce((p_settings->>'lateCancelHours')::int,-1) not between 0 and 168
     or jsonb_typeof(p_settings->'chargeLateCancel') is distinct from 'boolean'
     or jsonb_typeof(p_settings->'chargeNoShow') is distinct from 'boolean'
    then raise exception 'Check the PT booking settings.'; end if;
  update public.gyms set pt_booking_settings=p_settings where id=p_gym and organization_id=p_org;
  return found;
end;
$$;

create or replace function public.pt_workspace(p_org uuid,p_gym uuid,p_member boolean)
returns jsonb language sql stable security definer set search_path='' as $$
  with scope as (
    select a.*,m.full_name as member_name,m.repup_account_id,t.full_name as trainer_name,t.photo_url,t.specialization,
      t.experience_years,coalesce(t.trainer_status,case when t.is_active then 'active' else 'inactive' end) as trainer_status,
      coalesce(p.name,'PT Package') as package_name,coalesce(a.session_duration,p.pt_session_duration,t.session_duration,60) as duration,
      g.id as gym_id,g.timezone,public.pt_config(g.pt_booking_settings) as cfg
    from public.pt_client_assignments a join public.members m on m.id=a.member_id and m.organization_id=a.organization_id
    join public.trainers t on t.id=a.trainer_id and t.organization_id=a.organization_id
    join public.branches b on b.id=a.location_id and b.organization_id=a.organization_id
    join public.gyms g on g.id=b.gym_id and g.organization_id=a.organization_id
    left join public.membership_plans p on p.id=a.package_plan_id and p.organization_id=a.organization_id
    where auth.uid() is not null and (
      (p_member and m.repup_account_id=auth.uid() and m.status<>'archived')
      or (not p_member and a.organization_id=p_org and g.id=p_gym)
    )
  ), assignments as (
    select a.* from scope a where p_member or public.pt_actor(a.organization_id,a.location_id,a.member_id,a.trainer_id) in ('admin','trainer')
  ), booking_scope as (
    select s.*,a.member_name,a.package_name,a.timezone,actual.full_name as actual_name,original.full_name as original_name,
      creator.full_name as creator_name,
      case when s.status='pending_approval' and s.approval_expires_at<=now() then 'expired' else s.status end as effective_status
    from scope a join public.pt_sessions s on s.pt_client_assignment_id=a.id
    join public.trainers actual on actual.id=s.trainer_id join public.trainers original on original.id=s.assigned_trainer_id
    left join public.profiles creator on creator.id=s.created_by
    where p_member or public.pt_actor(a.organization_id,a.location_id,a.member_id,s.trainer_id) in ('admin','trainer')
      or (s.status='pending_approval' and public.pt_actor(a.organization_id,a.location_id,a.member_id,s.assigned_trainer_id)='trainer')
  )
  select jsonb_build_object(
    'canManage',not p_member and public.pt_admin(p_org,null),
    'assignments',coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'memberName',a.member_name,'trainerId',a.trainer_id,'trainerName',a.trainer_name,
        'trainerPhoto',a.photo_url,'trainerSpecialty',a.specialization,'trainerExperience',a.experience_years,'trainerStatus',a.trainer_status,
        'packageName',a.package_name,'total',a.sessions_total,'completed',c.completed,'reserved',c.reserved,
        'available',greatest(0,a.sessions_total-c.completed-c.reserved),'expiresOn',a.end_date,'duration',a.duration,'timezone',a.timezone,
        'earliestBookingDate',greatest(a.start_date,((now()+make_interval(mins=>(a.cfg->>'noticeMinutes')::int)) at time zone a.timezone)::date),
        'latestBookingDate',least(a.end_date,(now() at time zone a.timezone)::date+(a.cfg->>'advanceDays')::int),
        'assignmentHistory',coalesce((select jsonb_agg(jsonb_build_object(
          'time',h.created_at,'reason',h.metadata->>'reason','previousTrainer',previous.full_name,'newTrainer',replacement.full_name,
          'actorName',actor.full_name) order by h.created_at desc)
          from public.audit_logs h left join public.profiles actor on actor.id=h.actor_id
          left join public.trainers previous on previous.id::text=h.metadata->>'previous_trainer' and previous.organization_id=a.organization_id
          left join public.trainers replacement on replacement.id::text=h.metadata->>'new_trainer' and replacement.organization_id=a.organization_id
          where h.organization_id=a.organization_id and h.entity_type='pt_assignment' and h.entity_id=a.id and h.action='pt_assignment.trainer_replaced'),'[]'::jsonb))
        order by a.member_name,a.start_date desc)
      from assignments a cross join lateral public.pt_counts(a.id) c
      where a.status='active' and (a.end_date is null or a.end_date>=(now() at time zone a.timezone)::date)
    ),'[]'::jsonb),
    'bookings',coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'reference',s.booking_reference,
        'assignmentId',s.pt_client_assignment_id,'memberName',s.member_name,'trainerId',s.trainer_id,'trainerName',s.actual_name,
        'assignedTrainerName',s.original_name,'packageName',s.package_name,'date',(s.scheduled_at at time zone s.timezone)::date,
        'start',to_char(s.scheduled_at at time zone s.timezone,'HH24:MI'),'end',to_char((s.scheduled_at+make_interval(mins=>s.duration_minutes)) at time zone s.timezone,'HH24:MI'),
        'duration',s.duration_minutes,'status',s.effective_status,'createdBy',coalesce(s.creator_name,'Staff'),'scheduledAt',s.scheduled_at,'timezone',s.timezone,
        'approvalExpiresAt',s.approval_expires_at,'reason',s.cancellation_reason,
        'history',coalesce((select jsonb_agg(jsonb_build_object('action',h.action,'time',h.created_at,'reason',coalesce(h.metadata->>'reason',''),
          'previousStart',h.metadata->>'previous_start','newStart',h.metadata->>'new_start','previousTrainer',previous.full_name,
          'newTrainer',replacement.full_name,'actorName',actor.full_name) order by h.created_at desc)
          from public.audit_logs h left join public.profiles actor on actor.id=h.actor_id
          left join public.trainers previous on previous.id::text=h.metadata->>'previous_trainer' and previous.organization_id=s.organization_id
          left join public.trainers replacement on replacement.id::text=h.metadata->>'new_trainer' and replacement.organization_id=s.organization_id
          where h.organization_id=s.organization_id and h.entity_type='pt_session' and h.entity_id=s.id),'[]'::jsonb)) order by s.scheduled_at desc)
      from booking_scope s
    ),'[]'::jsonb),
    'assignmentHistory',coalesce((
      select jsonb_agg(jsonb_build_object('id',h.id,'assignmentId',a.id,'memberName',a.member_name,'packageName',a.package_name,
        'time',h.created_at,'reason',h.metadata->>'reason','previousTrainer',previous.full_name,'newTrainer',replacement.full_name,
        'actorName',actor.full_name,'changeType','permanent','timezone',a.timezone) order by h.created_at desc)
      from assignments a join public.audit_logs h on h.organization_id=a.organization_id and h.entity_id=a.id
        and h.entity_type='pt_assignment' and h.action='pt_assignment.trainer_replaced'
      left join public.profiles actor on actor.id=h.actor_id
      left join public.trainers previous on previous.id::text=h.metadata->>'previous_trainer' and previous.organization_id=a.organization_id
      left join public.trainers replacement on replacement.id::text=h.metadata->>'new_trainer' and replacement.organization_id=a.organization_id
      where not p_member and public.pt_admin(a.organization_id,a.location_id)
    ),'[]'::jsonb),
    'requests',coalesce((
      select jsonb_agg(jsonb_build_object('id',r.id,'assignmentId',r.assignment_id,'status',r.status,'reason',r.reason,'notes',r.notes,
        'memberName',a.member_name,'packageName',a.package_name,'trainerName',previous.full_name,'preferredTrainerName',preferred.full_name,
        'preferredTrainerId',preferred.id,'reviewReason',r.review_reason,'createdAt',r.created_at) order by r.created_at desc)
      from assignments a join public.pt_trainer_change_requests r on r.assignment_id=a.id
      join public.trainers previous on previous.id=r.current_trainer_id
      left join public.trainers preferred on preferred.id=r.preferred_trainer_id
      where p_member or public.pt_admin(a.organization_id,a.location_id)
    ),'[]'::jsonb),
    'trainers',coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'name',t.full_name) order by t.full_name)
      from public.trainers t where t.is_active and t.archived_at is null
        and exists(select 1 from public.trainer_roles r where r.trainer_id=t.id and r.role='TRAINER')
        and (
          (p_member and exists(select 1 from assignments a where a.organization_id=t.organization_id and a.gym_id=t.gym_id))
          or (not p_member and t.organization_id=p_org and t.gym_id=p_gym and public.pt_admin(p_org,null))
        )
    ),'[]'::jsonb)
  );
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[
      'pt_config','pt_open','pt_admin','pt_actor','pt_counts','pt_slot_error','pt_available_slots','pt_create_booking','pt_change_booking',
      'expire_pt_pending_bookings','pt_replace_trainer','pt_request_trainer_change','pt_review_trainer_change','pt_read_settings','pt_write_settings','pt_workspace'
    ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
    if f.proname=any(array['pt_available_slots','pt_create_booking','pt_change_booking','pt_replace_trainer','pt_request_trainer_change',
      'pt_review_trainer_change','pt_read_settings','pt_write_settings','pt_workspace']) then
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end;
$$;


create or replace function public.save_trainer_availability(p_org uuid,p_gym uuid,p_id uuid,p_availability jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare
  conflicts integer;
  zone text;
begin
  if not public.pt_admin(p_org,null) then raise exception 'Trainer management is restricted'; end if;
  if p_availability is null or jsonb_typeof(p_availability->'weekly') is distinct from 'array'
     or jsonb_typeof(p_availability->'timeOff') is distinct from 'array' then raise exception 'Invalid availability'; end if;
  if jsonb_array_length(p_availability->'weekly')>70 or jsonb_array_length(p_availability->'timeOff')>366
     or exists(select 1 from jsonb_array_elements(p_availability->'weekly') w
       where coalesce(w->>'day','') !~ '^[1-7]$' or coalesce(w->>'kind','') not in ('available','break')
         or coalesce(w->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(w->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or w->>'start'>=w->>'end')
     or exists(select 1 from jsonb_array_elements(p_availability->'timeOff') o
       where coalesce(o->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or coalesce(nullif(o->>'endDate',''),o->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or coalesce(nullif(o->>'startTime',''),'00:00') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(nullif(o->>'endTime',''),'24:00') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
         or coalesce(o->>'type','leave') not in ('leave','day_off','unavailable') or length(coalesce(o->>'reason',''))>160
         or (o->>'date')::date+coalesce(nullif(o->>'startTime','')::time,'00:00') >=
            coalesce(nullif(o->>'endDate',''),o->>'date')::date+coalesce(nullif(o->>'endTime','')::time,'24:00'))
     or exists(select 1 from jsonb_array_elements(p_availability->'weekly') with ordinality a(slot,n)
       join jsonb_array_elements(p_availability->'weekly') with ordinality b(slot,n) on a.n<b.n
       where a.slot->>'day'=b.slot->>'day' and a.slot->>'kind'=b.slot->>'kind'
         and a.slot->>'start'<b.slot->>'end' and b.slot->>'start'<a.slot->>'end')
     or exists(select 1 from jsonb_array_elements(p_availability->'weekly') b where b->>'kind'='break'
       and not exists(select 1 from jsonb_array_elements(p_availability->'weekly') w where w->>'kind'='available'
        and w->>'day'=b->>'day' and w->>'start'<=b->>'start' and w->>'end'>=b->>'end'))
  then raise exception 'Invalid availability'; end if;
  if exists (
    with spans as (
      select n,(o->>'date')::date+coalesce(nullif(o->>'startTime','')::time,'00:00') as start_at,
        coalesce(nullif(o->>'endDate',''),o->>'date')::date+coalesce(nullif(o->>'endTime','')::time,'24:00') as end_at
      from jsonb_array_elements(p_availability->'timeOff') with ordinality item(o,n)
    ) select 1 from spans a join spans b on a.n<b.n and a.start_at<b.end_at and b.start_at<a.end_at
  ) then raise exception 'Time off cannot overlap'; end if;
  update public.trainers t set availability=p_availability,updated_at=now()
  where t.id=p_id and t.organization_id=p_org and t.gym_id=p_gym and t.archived_at is null
    and exists(select 1 from public.trainer_roles r where r.trainer_id=t.id and r.role='TRAINER');
  if not found then raise exception 'Trainer not found'; end if;
  select timezone into zone from public.gyms where id=p_gym;
  select count(*) into conflicts from public.pt_sessions s
  where s.organization_id=p_org and s.trainer_id=p_id and s.status in ('scheduled','confirmed','pending_approval')
    and (s.status<>'pending_approval' or s.approval_expires_at>now()) and s.scheduled_at>=now()
    and not public.trainer_slot_allowed(p_availability,(s.scheduled_at at time zone zone)::date,
      (s.scheduled_at at time zone zone)::time,((s.scheduled_at+make_interval(mins=>s.duration_minutes)) at time zone zone)::time);
  return conflicts;
end;
$$;
