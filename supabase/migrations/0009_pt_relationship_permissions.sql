-- Rename the PT relationship to reflect its domain purpose.
alter table if exists coach_clients rename to pt_client_assignments;
alter table if exists pt_client_assignments rename column coach_id to trainer_id;
alter table if exists pt_client_assignments drop constraint if exists coach_clients_status_check;
alter table if exists pt_client_assignments add constraint pt_client_assignments_status_check check (status in ('active', 'paused', 'ended', 'expired', 'cancelled'));
alter table if exists pt_client_assignments add column if not exists created_by uuid references profiles(id);

alter table if exists pt_sessions rename column coach_client_id to pt_client_assignment_id;
alter table if exists pt_sessions rename column coach_id to trainer_id;
alter table if exists pt_sessions add column if not exists session_date date;
alter table if exists pt_sessions add column if not exists start_time time;
alter table if exists pt_sessions add column if not exists end_time time;
update pt_sessions set session_date = scheduled_at::date, start_time = scheduled_at::time, end_time = (scheduled_at + make_interval(mins => duration_minutes))::time where session_date is null;
alter table if exists pt_sessions alter column session_date set not null;
alter table if exists pt_sessions alter column start_time set not null;
alter table if exists pt_sessions alter column end_time set not null;

drop policy if exists "coach_clients_select" on pt_client_assignments;
drop policy if exists "coach_clients_insert" on pt_client_assignments;
drop policy if exists "coach_clients_update" on pt_client_assignments;
create policy "pt_assignments_select" on pt_client_assignments for select using (
  has_branch_access(location_id) and (is_org_wide(organization_id) or exists (select 1 from trainers t where t.id = trainer_id and t.user_id = auth.uid()))
);
create policy "pt_assignments_insert" on pt_client_assignments for insert with check (has_branch_access(location_id) and is_org_wide(organization_id));
create policy "pt_assignments_update" on pt_client_assignments for update using (has_branch_access(location_id) and is_org_wide(organization_id)) with check (has_branch_access(location_id) and is_org_wide(organization_id));

drop policy if exists "pt_sessions_select" on pt_sessions;
drop policy if exists "pt_sessions_insert" on pt_sessions;
drop policy if exists "pt_sessions_update" on pt_sessions;
create policy "pt_sessions_select" on pt_sessions for select using (
  has_branch_access(location_id) and (is_org_wide(organization_id) or exists (select 1 from trainers t where t.id = trainer_id and t.user_id = auth.uid()))
);
create policy "pt_sessions_insert" on pt_sessions for insert with check (
  has_branch_access(location_id) and exists (select 1 from pt_client_assignments a where a.id = pt_client_assignment_id and a.member_id = member_id and a.trainer_id = trainer_id and a.status = 'active' and (is_org_wide(a.organization_id) or exists (select 1 from trainers t where t.id = a.trainer_id and t.user_id = auth.uid())))
);
create policy "pt_sessions_update" on pt_sessions for update using (
  has_branch_access(location_id) and (is_org_wide(organization_id) or exists (select 1 from trainers t where t.id = trainer_id and t.user_id = auth.uid()))
) with check (has_branch_access(location_id));

insert into permissions (code, description) values
  ('pt_clients.view_all', 'View all personal training clients'), ('pt_clients.view_own', 'View assigned personal training clients'),
  ('pt_clients.create', 'Create personal training relationships'), ('pt_clients.edit', 'Edit personal training relationships'),
  ('pt_clients.change_trainer', 'Change personal training trainer'), ('pt_clients.deactivate', 'Deactivate personal training relationships'),
  ('pt_sessions.view_all', 'View all personal training sessions'), ('pt_sessions.view_own', 'View assigned personal training sessions'),
  ('pt_sessions.create_all', 'Schedule sessions for all PT clients'), ('pt_sessions.create_own', 'Schedule sessions for assigned PT clients'),
  ('pt_sessions.edit_all', 'Edit all personal training sessions'), ('pt_sessions.edit_own', 'Edit assigned personal training sessions'),
  ('pt_sessions.complete_own', 'Complete assigned personal training sessions')
on conflict (code) do update set description = excluded.description;
insert into role_permissions (role, permission_code) values
  ('owner', 'pt_clients.view_all'), ('owner', 'pt_clients.create'), ('owner', 'pt_clients.edit'), ('owner', 'pt_clients.change_trainer'), ('owner', 'pt_clients.deactivate'), ('owner', 'pt_sessions.view_all'), ('owner', 'pt_sessions.create_all'), ('owner', 'pt_sessions.edit_all'),
  ('admin', 'pt_clients.view_all'), ('admin', 'pt_clients.create'), ('admin', 'pt_clients.edit'), ('admin', 'pt_clients.change_trainer'), ('admin', 'pt_clients.deactivate'), ('admin', 'pt_sessions.view_all'), ('admin', 'pt_sessions.create_all'), ('admin', 'pt_sessions.edit_all'),
  ('manager', 'pt_clients.view_all'), ('manager', 'pt_clients.create'), ('manager', 'pt_clients.edit'), ('manager', 'pt_sessions.view_all'), ('manager', 'pt_sessions.create_all'),
  ('receptionist', 'pt_clients.view_all'), ('receptionist', 'pt_clients.view_own'), ('receptionist', 'pt_sessions.view_all'), ('receptionist', 'pt_sessions.create_all'),
  ('coach', 'pt_clients.view_own'), ('coach', 'pt_sessions.view_own'), ('coach', 'pt_sessions.create_own'), ('coach', 'pt_sessions.edit_own'), ('coach', 'pt_sessions.complete_own'),
  ('trainer', 'pt_clients.view_own'), ('trainer', 'pt_sessions.view_own'), ('trainer', 'pt_sessions.create_own'), ('trainer', 'pt_sessions.edit_own'), ('trainer', 'pt_sessions.complete_own')
on conflict do nothing;
