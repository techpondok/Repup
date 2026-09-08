-- =========================================================
-- RepUp Gym — Row Level Security
-- Tenant isolation: organization -> gym -> branch
-- =========================================================

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_users enable row level security;
alter table gyms enable row level security;
alter table branches enable row level security;
alter table branch_users enable row level security;
alter table members enable row level security;
alter table membership_plans enable row level security;
alter table membership_plan_branches enable row level security;
alter table memberships enable row level security;
alter table membership_events enable row level security;
alter table check_ins enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table payments enable row level security;
alter table trainers enable row level security;
alter table trainer_branches enable row level security;
alter table classes enable row level security;
alter table class_participants enable row level security;
alter table equipment_categories enable row level security;
alter table equipment enable row level security;
alter table audit_logs enable row level security;

-- ---------------------------------------------------------
-- Helper functions (security definer to avoid recursive RLS)
-- ---------------------------------------------------------
create or replace function is_super_admin()
returns boolean as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer set search_path = public;

create or replace function is_org_member(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from organization_users
    where organization_id = p_org_id and user_id = auth.uid()
  ) or is_super_admin();
$$ language sql stable security definer set search_path = public;

create or replace function org_role(p_org_id uuid)
returns org_role as $$
  select role from organization_users
  where organization_id = p_org_id and user_id = auth.uid()
  limit 1;
$$ language sql stable security definer set search_path = public;

-- Org-wide access roles (owner/admin see every branch in their org)
create or replace function is_org_wide(p_org_id uuid)
returns boolean as $$
  select org_role(p_org_id) in ('owner', 'admin') or is_super_admin();
$$ language sql stable security definer set search_path = public;

create or replace function has_branch_access(p_branch_id uuid)
returns boolean as $$
  select
    is_super_admin()
    or exists (
      select 1 from branches b
      where b.id = p_branch_id and is_org_wide(b.organization_id)
    )
    or exists (
      select 1 from branch_users bu
      where bu.branch_id = p_branch_id and bu.user_id = auth.uid()
    );
$$ language sql stable security definer set search_path = public;

create or replace function has_org_access(p_org_id uuid)
returns boolean as $$
  select is_org_member(p_org_id);
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------
-- PROFILES: a user can read/update their own profile.
-- Profiles of teammates within the same org are readable (for staff lists).
-- ---------------------------------------------------------
create policy "profiles_self" on profiles for select using (id = auth.uid() or is_super_admin());
create policy "profiles_teammates" on profiles for select using (
  exists (
    select 1 from organization_users ou1
    join organization_users ou2 on ou1.organization_id = ou2.organization_id
    where ou1.user_id = auth.uid() and ou2.user_id = profiles.id
  )
);
create policy "profiles_update_self" on profiles for update using (id = auth.uid());
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid());

-- ---------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------
create policy "org_select" on organizations for select using (is_org_member(id));
create policy "org_insert_owner" on organizations for insert with check (owner_id = auth.uid());
create policy "org_update_owner" on organizations for update using (is_org_wide(id));

-- ---------------------------------------------------------
-- ORGANIZATION_USERS
-- ---------------------------------------------------------
create policy "org_users_select" on organization_users for select using (is_org_member(organization_id));
create policy "org_users_insert" on organization_users for insert with check (
  is_org_wide(organization_id)
  or not exists (select 1 from organization_users where organization_id = organization_users.organization_id)
);
create policy "org_users_update" on organization_users for update using (is_org_wide(organization_id));
create policy "org_users_delete" on organization_users for delete using (is_org_wide(organization_id));

-- ---------------------------------------------------------
-- GYMS
-- ---------------------------------------------------------
create policy "gyms_select" on gyms for select using (is_org_member(organization_id));
create policy "gyms_insert" on gyms for insert with check (is_org_wide(organization_id));
create policy "gyms_update" on gyms for update using (is_org_wide(organization_id));

-- ---------------------------------------------------------
-- BRANCHES
-- ---------------------------------------------------------
create policy "branches_select" on branches for select using (has_branch_access(id));
create policy "branches_insert" on branches for insert with check (is_org_wide(organization_id));
create policy "branches_update" on branches for update using (is_org_wide(organization_id));

create policy "branch_users_select" on branch_users for select using (is_org_member(organization_id));
create policy "branch_users_insert" on branch_users for insert with check (is_org_wide(organization_id));
create policy "branch_users_delete" on branch_users for delete using (is_org_wide(organization_id));

-- ---------------------------------------------------------
-- MEMBERS
-- ---------------------------------------------------------
create policy "members_select" on members for select using (has_branch_access(branch_id));
create policy "members_insert" on members for insert with check (has_branch_access(branch_id));
create policy "members_update" on members for update using (has_branch_access(branch_id));

-- ---------------------------------------------------------
-- MEMBERSHIP PLANS (org/gym level, visible to whole org membership)
-- ---------------------------------------------------------
create policy "plans_select" on membership_plans for select using (is_org_member(organization_id));
create policy "plans_insert" on membership_plans for insert with check (is_org_wide(organization_id));
create policy "plans_update" on membership_plans for update using (is_org_wide(organization_id));

create policy "plan_branches_select" on membership_plan_branches for select using (
  exists (select 1 from membership_plans p where p.id = plan_id and is_org_member(p.organization_id))
);
create policy "plan_branches_insert" on membership_plan_branches for insert with check (
  exists (select 1 from membership_plans p where p.id = plan_id and is_org_wide(p.organization_id))
);
create policy "plan_branches_delete" on membership_plan_branches for delete using (
  exists (select 1 from membership_plans p where p.id = plan_id and is_org_wide(p.organization_id))
);

-- ---------------------------------------------------------
-- MEMBERSHIPS / EVENTS
-- ---------------------------------------------------------
create policy "memberships_select" on memberships for select using (has_branch_access(branch_id));
create policy "memberships_insert" on memberships for insert with check (has_branch_access(branch_id));
create policy "memberships_update" on memberships for update using (has_branch_access(branch_id));

create policy "membership_events_select" on membership_events for select using (
  exists (select 1 from memberships m where m.id = membership_id and has_branch_access(m.branch_id))
);
create policy "membership_events_insert" on membership_events for insert with check (
  exists (select 1 from memberships m where m.id = membership_id and has_branch_access(m.branch_id))
);

-- ---------------------------------------------------------
-- CHECK-INS
-- ---------------------------------------------------------
create policy "checkins_select" on check_ins for select using (has_branch_access(branch_id));
create policy "checkins_insert" on check_ins for insert with check (has_branch_access(branch_id));

-- ---------------------------------------------------------
-- PRODUCTS / CATEGORIES
-- ---------------------------------------------------------
create policy "product_categories_select" on product_categories for select using (is_org_member(organization_id));
create policy "product_categories_insert" on product_categories for insert with check (is_org_wide(organization_id));

create policy "products_select" on products for select using (is_org_member(organization_id));
create policy "products_insert" on products for insert with check (is_org_wide(organization_id));
create policy "products_update" on products for update using (is_org_wide(organization_id));

-- ---------------------------------------------------------
-- TRANSACTIONS / ITEMS / PAYMENTS
-- ---------------------------------------------------------
create policy "transactions_select" on transactions for select using (has_branch_access(branch_id));
create policy "transactions_insert" on transactions for insert with check (has_branch_access(branch_id));
create policy "transactions_update" on transactions for update using (has_branch_access(branch_id));

create policy "txn_items_select" on transaction_items for select using (
  exists (select 1 from transactions t where t.id = transaction_id and has_branch_access(t.branch_id))
);
create policy "txn_items_insert" on transaction_items for insert with check (
  exists (select 1 from transactions t where t.id = transaction_id and has_branch_access(t.branch_id))
);

create policy "payments_select" on payments for select using (is_org_member(organization_id));
create policy "payments_insert" on payments for insert with check (is_org_member(organization_id));

-- ---------------------------------------------------------
-- TRAINERS
-- ---------------------------------------------------------
create policy "trainers_select" on trainers for select using (is_org_member(organization_id));
create policy "trainers_insert" on trainers for insert with check (is_org_wide(organization_id));
create policy "trainers_update" on trainers for update using (is_org_wide(organization_id));

create policy "trainer_branches_select" on trainer_branches for select using (
  exists (select 1 from trainers t where t.id = trainer_id and is_org_member(t.organization_id))
);
create policy "trainer_branches_insert" on trainer_branches for insert with check (
  exists (select 1 from trainers t where t.id = trainer_id and is_org_wide(t.organization_id))
);

-- ---------------------------------------------------------
-- CLASSES
-- ---------------------------------------------------------
create policy "classes_select" on classes for select using (has_branch_access(branch_id));
create policy "classes_insert" on classes for insert with check (has_branch_access(branch_id));
create policy "classes_update" on classes for update using (has_branch_access(branch_id));

create policy "class_participants_select" on class_participants for select using (
  exists (select 1 from classes c where c.id = class_id and has_branch_access(c.branch_id))
);
create policy "class_participants_insert" on class_participants for insert with check (
  exists (select 1 from classes c where c.id = class_id and has_branch_access(c.branch_id))
);

-- ---------------------------------------------------------
-- EQUIPMENT
-- ---------------------------------------------------------
create policy "equipment_categories_select" on equipment_categories for select using (true);

create policy "equipment_select" on equipment for select using (has_branch_access(branch_id));
create policy "equipment_insert" on equipment for insert with check (has_branch_access(branch_id));
create policy "equipment_update" on equipment for update using (has_branch_access(branch_id));

-- ---------------------------------------------------------
-- AUDIT LOGS (read-only for org-wide roles; inserts via server actions using service role or org members)
-- ---------------------------------------------------------
create policy "audit_select" on audit_logs for select using (organization_id is null or is_org_wide(organization_id));
create policy "audit_insert" on audit_logs for insert with check (organization_id is null or is_org_member(organization_id));
