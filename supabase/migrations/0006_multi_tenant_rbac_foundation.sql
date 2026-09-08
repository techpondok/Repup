-- RepUp Business: universal business identity and RBAC foundation.
-- Forward-only migration. Existing gym/branch data remains intact.

alter type org_role add value if not exists 'receptionist';
alter type org_role add value if not exists 'coach';

alter table organizations
  add column if not exists business_type text not null default 'gym_fitness_center',
  add column if not exists timezone text not null default 'Asia/Jakarta',
  add column if not exists currency text not null default 'IDR',
  add column if not exists is_demo boolean not null default false;

alter table profiles
  add column if not exists is_demo_user boolean not null default false;

alter table organizations
  drop constraint if exists organizations_business_type_check;
alter table organizations
  add constraint organizations_business_type_check check (business_type in (
    'gym_fitness_center', 'yoga_studio', 'pilates_studio', 'martial_arts_dojo',
    'boxing_club', 'muay_thai_club', 'mma_gym', 'cross_training',
    'calisthenics_studio', 'personal_training_studio', 'dance_fitness_studio',
    'running_club', 'sports_academy', 'sports_club', 'other'
  ));

-- Universal naming for new code. Existing branches are the location entity.
comment on table branches is 'RepUp Location entity; legacy table name retained for compatibility.';
comment on table trainers is 'RepUp Coach/Instructor entity; legacy table name retained for compatibility.';

create table if not exists permissions (
  code text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role text not null check (role in ('owner','admin','manager','receptionist','cashier','staff','coach','trainer')),
  permission_code text not null references permissions(code) on delete cascade,
  primary key (role, permission_code)
);

alter table permissions enable row level security;
alter table role_permissions enable row level security;

create policy "permissions_authenticated_read" on permissions for select to authenticated using (true);
create policy "role_permissions_authenticated_read" on role_permissions for select to authenticated using (true);

insert into permissions (code, description) values
  ('dashboard.view', 'View organization dashboard'),
  ('members.view', 'View members'),
  ('members.edit', 'Create and edit members'),
  ('membership.sell', 'Sell and activate memberships'),
  ('membership.manage', 'Freeze, renew, extend, and cancel memberships'),
  ('pos.use', 'Use point of sale'),
  ('transactions.view', 'View transactions and payments'),
  ('checkin.manage', 'Perform and review check-ins'),
  ('classes.manage', 'Manage classes and bookings'),
  ('coach.manage', 'Manage coaches and assignments'),
  ('reports.view', 'View reports'),
  ('staff.manage', 'Manage staff and permissions'),
  ('settings.manage', 'Manage organization settings'),
  ('locations.manage', 'Manage locations'),
  ('audit.view', 'View audit log')
on conflict (code) do update set description = excluded.description;

insert into role_permissions (role, permission_code)
select r.role, p.code
from (values
  ('owner'), ('admin')
) as r(role)
cross join permissions p
on conflict do nothing;

insert into role_permissions (role, permission_code) values
  ('manager', 'dashboard.view'), ('manager', 'members.view'), ('manager', 'members.edit'),
  ('manager', 'membership.sell'), ('manager', 'membership.manage'), ('manager', 'pos.use'),
  ('manager', 'transactions.view'), ('manager', 'checkin.manage'), ('manager', 'classes.manage'),
  ('manager', 'coach.manage'), ('manager', 'reports.view'),
  ('receptionist', 'dashboard.view'), ('receptionist', 'members.view'), ('receptionist', 'members.edit'),
  ('receptionist', 'membership.sell'), ('receptionist', 'checkin.manage'), ('receptionist', 'classes.manage'),
  ('cashier', 'members.view'), ('cashier', 'membership.sell'), ('cashier', 'pos.use'),
  ('cashier', 'transactions.view'), ('cashier', 'checkin.manage'),
  ('staff', 'dashboard.view'), ('staff', 'members.view'), ('staff', 'checkin.manage'),
  ('coach', 'dashboard.view'), ('coach', 'members.view'), ('coach', 'classes.manage'), ('coach', 'checkin.manage'),
  ('trainer', 'dashboard.view'), ('trainer', 'members.view'), ('trainer', 'classes.manage'), ('trainer', 'checkin.manage')
on conflict do nothing;

-- Active membership status is part of authorization, not just UI filtering.
create or replace function is_org_member(p_org_id uuid)
returns boolean as $$
  select coalesce((select is_super_admin()), false) or exists (
    select 1 from organization_users
    where organization_id = p_org_id and user_id = auth.uid() and status = 'active'
  );
$$ language sql stable security definer set search_path = public;

create or replace function org_role(p_org_id uuid)
returns org_role as $$
  select role from organization_users
  where organization_id = p_org_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$ language sql stable security definer set search_path = public;

-- Prevent a caller from pairing a row with another tenant's branch/gym.
create or replace function validate_tenant_scope()
returns trigger as $$
declare
  v_org uuid;
  v_gym uuid;
begin
  if new.branch_id is not null then
    select organization_id, gym_id into v_org, v_gym from branches where id = new.branch_id;
    if v_org is null or v_org <> new.organization_id then
      raise exception 'Branch does not belong to organization';
    end if;
    if new.gym_id is not null and v_gym <> new.gym_id then
      raise exception 'Branch does not belong to gym';
    end if;
  elsif new.gym_id is not null then
    if not exists (select 1 from gyms where id = new.gym_id and organization_id = new.organization_id) then
      raise exception 'Gym does not belong to organization';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['members','memberships','check_ins','transactions','classes','equipment'] loop
    execute format('drop trigger if exists trg_%I_tenant_scope on %I', t, t);
    execute format('create trigger trg_%I_tenant_scope before insert or update on %I for each row execute function validate_tenant_scope()', t, t);
  end loop;
end $$;

-- Organization membership itself must not be used to smuggle a user into a tenant.
create or replace function validate_organization_user_scope()
returns trigger as $$
begin
  if new.user_id is null and new.invited_email is null then
    raise exception 'Organization user requires user_id or invited_email';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_organization_user_scope on organization_users;
create trigger trg_organization_user_scope
before insert or update on organization_users
for each row execute function validate_organization_user_scope();

-- Only an organization owner/admin may add membership rows. The previous
-- bootstrap exception could let an authenticated user claim an empty tenant.
drop policy if exists "org_users_insert" on organization_users;
create policy "org_users_insert" on organization_users
for insert to authenticated
with check (
  is_org_wide(organization_id)
  or exists (
    select 1 from organizations o
    where o.id = organization_id and o.owner_id = auth.uid()
  )
);

-- Every branch-scoped update must remain inside the same authorized branch.
drop policy if exists "members_update" on members;
create policy "members_update" on members for update
using (has_branch_access(branch_id))
with check (has_branch_access(branch_id));
drop policy if exists "memberships_update" on memberships;
create policy "memberships_update" on memberships for update
using (has_branch_access(branch_id))
with check (has_branch_access(branch_id));
drop policy if exists "transactions_update" on transactions;
create policy "transactions_update" on transactions for update
using (has_branch_access(branch_id))
with check (has_branch_access(branch_id));
