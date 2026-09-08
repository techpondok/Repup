-- Personal training uses existing members, membership plans, and transactions.
create table if not exists coach_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references branches(id),
  member_id uuid not null references members(id) on delete cascade,
  coach_id uuid not null references trainers(id),
  package_plan_id uuid references membership_plans(id),
  membership_id uuid references memberships(id),
  start_date date not null,
  end_date date,
  sessions_total integer not null default 0 check (sessions_total >= 0),
  sessions_used integer not null default 0 check (sessions_used >= 0 and sessions_used <= sessions_total),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  goal text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_coach_clients_org on coach_clients(organization_id);
create index if not exists idx_coach_clients_member on coach_clients(member_id);
create index if not exists idx_coach_clients_coach on coach_clients(coach_id);
create index if not exists idx_coach_clients_location on coach_clients(location_id);

create table if not exists pt_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid not null references branches(id),
  coach_client_id uuid not null references coach_clients(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  coach_id uuid not null references trainers(id),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled')),
  session_credit_consumed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pt_sessions_client on pt_sessions(coach_client_id);
create index if not exists idx_pt_sessions_coach_date on pt_sessions(coach_id, scheduled_at);

alter table coach_clients enable row level security;
alter table pt_sessions enable row level security;
drop policy if exists "coach_clients_select" on coach_clients;
create policy "coach_clients_select" on coach_clients for select using (has_branch_access(location_id));
drop policy if exists "coach_clients_insert" on coach_clients;
create policy "coach_clients_insert" on coach_clients for insert with check (has_branch_access(location_id));
drop policy if exists "coach_clients_update" on coach_clients;
create policy "coach_clients_update" on coach_clients for update using (has_branch_access(location_id)) with check (has_branch_access(location_id));
drop policy if exists "pt_sessions_select" on pt_sessions;
create policy "pt_sessions_select" on pt_sessions for select using (has_branch_access(location_id));
drop policy if exists "pt_sessions_insert" on pt_sessions;
create policy "pt_sessions_insert" on pt_sessions for insert with check (has_branch_access(location_id));
drop policy if exists "pt_sessions_update" on pt_sessions;
create policy "pt_sessions_update" on pt_sessions for update using (has_branch_access(location_id)) with check (has_branch_access(location_id));
grant select, insert, update on coach_clients, pt_sessions to authenticated;

insert into permissions (code, description) values
  ('pt.clients.view', 'View personal training clients'),
  ('pt.clients.manage', 'Assign and manage personal training clients'),
  ('pt.sessions.manage', 'Schedule and manage personal training sessions')
on conflict (code) do update set description = excluded.description;
insert into role_permissions (role, permission_code) values
  ('manager', 'pt.clients.view'), ('manager', 'pt.sessions.manage'),
  ('receptionist', 'pt.clients.view'), ('receptionist', 'pt.sessions.manage'),
  ('coach', 'pt.clients.view'), ('coach', 'pt.sessions.manage'),
  ('trainer', 'pt.clients.view'), ('trainer', 'pt.sessions.manage')
on conflict do nothing;
