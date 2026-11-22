create sequence if not exists public.trainer_code_seq start with 100001;

alter table public.trainers
  add column if not exists trainer_code text,
  add column if not exists trainer_status text check (trainer_status in ('active', 'inactive', 'on_leave')),
  add column if not exists employment_schedule text check (employment_schedule in ('full_time', 'part_time', 'freelance')),
  add column if not exists gender text,
  add column if not exists biography text,
  add column if not exists specializations text[],
  add column if not exists experience_years integer not null default 0 check (experience_years between 0 and 100),
  add column if not exists certifications text,
  add column if not exists default_session_rate numeric(14,2) not null default 0 check (default_session_rate >= 0),
  add column if not exists session_duration integer not null default 60 check (session_duration in (30, 45, 60, 90)),
  add column if not exists availability jsonb;

alter table public.trainers alter column trainer_code set default
  ('TRN-' || nextval('public.trainer_code_seq')::text);
update public.trainers set trainer_code = default where trainer_code is null;
alter table public.trainers alter column trainer_code set not null;
create unique index if not exists trainers_gym_code on public.trainers(gym_id, trainer_code);
grant usage on sequence public.trainer_code_seq to authenticated;

create policy "trainers_limit_self_service_reads" on public.trainers as restrictive for select to authenticated
using (coalesce(public.org_role(organization_id) not in ('coach','trainer'), true) or user_id=auth.uid());

alter table public.pt_sessions add column if not exists schedule_change_reason text;
create index if not exists idx_pt_sessions_open_slots on public.pt_sessions(trainer_id, scheduled_at)
  where status in ('scheduled', 'confirmed');
create index if not exists idx_pt_sessions_open_member on public.pt_sessions(member_id, scheduled_at)
  where status in ('scheduled', 'confirmed');

create or replace function public.trainer_slot_allowed(p_availability jsonb, p_date date, p_start time, p_end time)
returns boolean language sql immutable set search_path = '' as $$
  select p_availability is null or (
    not exists (select 1 from jsonb_array_elements(p_availability->'timeOff') o where (o->>'date')::date = p_date)
    and exists (
      select 1 from jsonb_array_elements(p_availability->'weekly') w
      where (w->>'day')::integer = extract(isodow from p_date) and w->>'kind' = 'available'
        and (w->>'start')::time <= p_start and (w->>'end')::time >= p_end
    )
    and not exists (
      select 1 from jsonb_array_elements(p_availability->'weekly') w
      where (w->>'day')::integer = extract(isodow from p_date) and w->>'kind' = 'break'
        and (w->>'start')::time < p_end and p_start < (w->>'end')::time
    )
  );
$$;

create or replace function public.save_managed_trainer(
  p_org uuid, p_gym uuid, p_branch uuid, p_id uuid, p_profile jsonb
) returns uuid language plpgsql set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_specializations text[];
  v_type public.employment_type;
  v_name text := trim(p_profile->>'name');
begin
  if not exists (
    select 1 from public.organization_users u where u.organization_id=p_org and u.user_id=auth.uid()
      and u.role in ('owner','admin') and u.status='active'
  ) or not exists (
    select 1 from public.branches b where b.id = p_branch and b.gym_id = p_gym and b.organization_id = p_org
  ) then raise exception 'Trainer management is restricted'; end if;
  if v_name is null or v_name = '' or length(v_name) > 100 or coalesce(p_profile->>'phone','') !~ '^\+?[0-9 ()-]{7,22}$'
     or length(regexp_replace(p_profile->>'phone', '[^0-9]', '', 'g')) not between 7 and 15
     or (p_profile->>'email' is not null and p_profile->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     or coalesce(p_profile->>'status','') not in ('active', 'inactive', 'on_leave')
     or coalesce(p_profile->>'employment','') not in ('full_time', 'part_time', 'freelance')
     or coalesce(p_profile->>'rate','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
     or (p_profile->>'photo' is not null and (length(p_profile->>'photo') > 699100
       or p_profile->>'photo' !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$')) then
    raise exception 'Invalid trainer profile';
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into v_specializations from jsonb_array_elements_text(p_profile->'specializations');
  v_type := case when p_profile->>'employment' = 'freelance' then 'freelance'::public.employment_type else 'employee'::public.employment_type end;
  if v_id is null then
    insert into public.trainers (organization_id,gym_id,full_name,phone,email,gender,biography,specializations,specialization,
      experience_years,certifications,employment_type,employment_schedule,trainer_status,is_active,default_session_rate,session_duration,photo_url,availability)
    values (p_org,p_gym,v_name,p_profile->>'phone',p_profile->>'email',p_profile->>'gender',p_profile->>'bio',v_specializations,
      nullif(array_to_string(v_specializations, ', '), ''),(p_profile->>'experience')::integer,p_profile->>'certifications',v_type,
      p_profile->>'employment',p_profile->>'status',p_profile->>'status' = 'active',(p_profile->>'rate')::numeric,
      (p_profile->>'duration')::integer,p_profile->>'photo','{"weekly":[],"timeOff":[]}'::jsonb) returning id into v_id;
    insert into public.trainer_branches (trainer_id,branch_id) values (v_id,p_branch);
    insert into public.trainer_roles (trainer_id,role) values (v_id,'TRAINER');
  else
    update public.trainers t set full_name=v_name,phone=p_profile->>'phone',email=p_profile->>'email',
      gender=p_profile->>'gender',biography=p_profile->>'bio',specializations=v_specializations,
      specialization=nullif(array_to_string(v_specializations, ', '), ''),experience_years=(p_profile->>'experience')::integer,
      certifications=p_profile->>'certifications',employment_type=v_type,employment_schedule=p_profile->>'employment',
      trainer_status=p_profile->>'status',is_active=p_profile->>'status' = 'active',default_session_rate=(p_profile->>'rate')::numeric,
      session_duration=(p_profile->>'duration')::integer,photo_url=coalesce(p_profile->>'photo',t.photo_url),updated_at=now()
    where t.id=v_id and t.organization_id=p_org and t.gym_id=p_gym and t.archived_at is null
      and exists (select 1 from public.trainer_roles r where r.trainer_id=t.id and r.role='TRAINER');
    if not found then raise exception 'Trainer not found'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.save_trainer_availability(p_org uuid,p_gym uuid,p_id uuid,p_availability jsonb)
returns integer language plpgsql set search_path = '' as $$
declare
  v_conflicts integer;
begin
  if not exists (
    select 1 from public.organization_users u where u.organization_id=p_org and u.user_id=auth.uid()
      and u.role in ('owner','admin') and u.status='active'
  ) then
    raise exception 'Trainer management is restricted';
  end if;
  if p_availability is null or jsonb_typeof(p_availability->'weekly') is distinct from 'array'
     or jsonb_typeof(p_availability->'timeOff') is distinct from 'array' then raise exception 'Invalid availability'; end if;
  if jsonb_array_length(p_availability->'weekly') > 70 or jsonb_array_length(p_availability->'timeOff') > 366
     or exists (
       select 1 from jsonb_array_elements(p_availability->'weekly') w
       where coalesce(w->>'day','') !~ '^[1-7]$' or coalesce(w->>'kind','') not in ('available','break')
         or coalesce(w->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(w->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or w->>'start' >= w->>'end'
     ) or exists (
       select 1 from jsonb_array_elements(p_availability->'timeOff') o
       where coalesce(o->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or (o->>'date')::date is null or length(coalesce(o->>'reason','')) > 160
     ) or exists (
       select 1 from jsonb_array_elements(p_availability->'timeOff') o group by o->>'date' having count(*) > 1
     ) or exists (
       select 1 from jsonb_array_elements(p_availability->'weekly') with ordinality a(slot,n)
       join jsonb_array_elements(p_availability->'weekly') with ordinality b(slot,n) on a.n < b.n
         and a.slot->>'day' = b.slot->>'day' and a.slot->>'kind' = b.slot->>'kind'
         and a.slot->>'start' < b.slot->>'end' and b.slot->>'start' < a.slot->>'end'
     ) then raise exception 'Invalid availability'; end if;
  update public.trainers t set availability=p_availability,updated_at=now()
  where t.id=p_id and t.organization_id=p_org and t.gym_id=p_gym and t.archived_at is null
    and exists (select 1 from public.trainer_roles r where r.trainer_id=t.id and r.role='TRAINER');
  if not found then raise exception 'Trainer not found'; end if;
  select count(*) into v_conflicts from public.pt_sessions s
  where s.organization_id=p_org and s.trainer_id=p_id and s.status in ('scheduled','confirmed') and s.scheduled_at>=now()
    and not public.trainer_slot_allowed(p_availability,(s.scheduled_at at time zone 'Asia/Jakarta')::date,
      (s.scheduled_at at time zone 'Asia/Jakarta')::time,
      ((s.scheduled_at + make_interval(mins => s.duration_minutes)) at time zone 'Asia/Jakarta')::time);
  return v_conflicts;
end;
$$;

revoke execute on function public.save_managed_trainer(uuid,uuid,uuid,uuid,jsonb), public.save_trainer_availability(uuid,uuid,uuid,jsonb) from public, anon;
grant execute on function public.save_managed_trainer(uuid,uuid,uuid,uuid,jsonb), public.save_trainer_availability(uuid,uuid,uuid,jsonb) to authenticated;

create or replace function public.protect_pt_session_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_changed boolean := true;
  v_activated boolean := true;
  v_cancelled boolean := false;
  v_trainer public.trainers%rowtype;
  v_start timestamp;
  v_end timestamp;
  v_action text;
  v_reason text;
begin
  if tg_op = 'UPDATE' then
    if (new.organization_id,new.location_id,new.trainer_id,new.member_id,new.pt_client_assignment_id) is distinct from
       (old.organization_id,old.location_id,old.trainer_id,old.member_id,old.pt_client_assignment_id) then
      raise exception 'The PT session assignment cannot change';
    end if;
    v_changed := (new.scheduled_at,new.duration_minutes) is distinct from (old.scheduled_at,old.duration_minutes);
    v_activated := old.status not in ('scheduled','confirmed') and new.status in ('scheduled','confirmed');
    v_cancelled := old.status <> 'cancelled' and new.status = 'cancelled';
    if (v_changed or v_activated or v_cancelled) and old.status not in ('scheduled','confirmed') then
      raise exception 'Only scheduled or confirmed sessions can be rescheduled or cancelled';
    end if;
    if v_cancelled and v_changed then raise exception 'Cancel the session without changing its schedule'; end if;
  end if;
  if ((v_changed or v_activated) and new.status in ('scheduled','confirmed'))
     or (tg_op = 'UPDATE' and v_changed and new.status <> 'cancelled') then
    perform pg_advisory_xact_lock(hashtextextended('pt_member:' || new.member_id::text, 0));
    -- Updating the trainer row serializes bookings and availability changes.
    update public.trainers t set availability=t.availability where t.id=new.trainer_id and t.organization_id=new.organization_id
      and t.archived_at is null returning t.* into v_trainer;
    if not found or not exists (
      select 1 from public.pt_client_assignments a join public.branches b on b.id=a.location_id
      where a.id=new.pt_client_assignment_id and a.organization_id=new.organization_id and a.location_id=new.location_id
        and a.member_id=new.member_id and a.trainer_id=new.trainer_id and b.gym_id=v_trainer.gym_id
        and b.organization_id=new.organization_id and a.status='active'
    ) then raise exception 'The PT session assignment is invalid'; end if;
    v_start := new.scheduled_at at time zone 'Asia/Jakarta';
    v_end := v_start + make_interval(mins => new.duration_minutes);
    if v_start::date <> v_end::date or v_end <= v_start then raise exception 'Invalid session time range'; end if;
    new.session_date := v_start::date;
    new.start_time := v_start::time;
    new.end_time := v_end::time;
    if not v_trainer.is_active or coalesce(v_trainer.trainer_status,'active') <> 'active'
      or not public.trainer_slot_allowed(v_trainer.availability,v_start::date,v_start::time,v_end::time) then
      raise exception 'Trainer is unavailable during this time. Please choose another available slot.';
    end if;
    if exists (
      select 1 from public.pt_sessions s where s.trainer_id=new.trainer_id and s.id<>new.id and s.status in ('scheduled','confirmed')
      and s.scheduled_at < new.scheduled_at + make_interval(mins => new.duration_minutes)
      and new.scheduled_at < s.scheduled_at + make_interval(mins => s.duration_minutes)
    ) then
      raise exception 'Trainer already has a scheduled session during this time. Please choose another available slot.';
    end if;
    if exists (
      select 1 from public.pt_sessions s where s.member_id=new.member_id and s.id<>new.id and s.status in ('scheduled','confirmed')
      and s.scheduled_at < new.scheduled_at + make_interval(mins => new.duration_minutes)
      and new.scheduled_at < s.scheduled_at + make_interval(mins => s.duration_minutes)
    ) then
      raise exception 'Member tidak tersedia pada waktu tersebut.';
    end if;
  end if;
  if tg_op = 'UPDATE' and not v_changed then
    v_start := new.scheduled_at at time zone 'Asia/Jakarta';
    v_end := v_start + make_interval(mins => new.duration_minutes);
    new.session_date := v_start::date;
    new.start_time := v_start::time;
    new.end_time := v_end::time;
  end if;
  if tg_op = 'UPDATE' and (v_changed or v_cancelled) then
    v_action := case when v_cancelled then 'pt_session.cancelled' else 'pt_session.rescheduled' end;
    v_reason := case when new.schedule_change_reason is distinct from old.schedule_change_reason
      then nullif(trim(new.schedule_change_reason),'') end;
    insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
    values (new.organization_id,auth.uid(),v_action,'pt_session',new.id,
      jsonb_build_object('reason',coalesce(v_reason,'Changed through PT Clients'),
        'previous_start',old.scheduled_at,'previous_duration',old.duration_minutes,'previous_status',old.status,
        'new_start',new.scheduled_at,'new_duration',new.duration_minutes,'new_status',new.status));
    new.schedule_change_reason := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_pt_session_schedule() from public, anon, authenticated;

create trigger protect_pt_session_schedule before insert or update of organization_id,location_id,trainer_id,member_id,
  pt_client_assignment_id,scheduled_at,duration_minutes,session_date,start_time,end_time,status on public.pt_sessions
for each row execute function public.protect_pt_session_schedule();
