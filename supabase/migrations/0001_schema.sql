-- =========================================================
-- RepUp Gym — Core Schema
-- Multi-tenant gym management SaaS
-- Hierarchy: Organization -> Gym -> Branch
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
create type org_role as enum ('owner', 'admin', 'manager', 'cashier', 'trainer', 'staff');
create type branch_status as enum ('active', 'inactive');
create type member_status as enum ('active', 'expiring_soon', 'expired', 'suspended', 'visitor', 'archived');
create type duration_unit as enum ('day', 'month', 'year', 'visit');
create type branch_access_type as enum ('single', 'selected', 'all');
create type membership_status as enum ('pending', 'active', 'expiring_soon', 'expired', 'frozen', 'cancelled');
create type payment_status as enum ('unpaid', 'pending', 'paid', 'refunded');
create type membership_event_type as enum ('activated', 'renewed', 'extended', 'frozen', 'unfrozen', 'cancelled', 'expired');
create type checkin_method as enum ('search', 'member_id', 'qr', 'manual');
create type checkin_status as enum ('success', 'denied');
create type product_type as enum ('membership', 'day_pass', 'personal_training', 'class', 'merchandise', 'supplement', 'other');
create type transaction_type as enum ('sale', 'membership_purchase', 'renewal', 'other');
create type transaction_status as enum ('pending', 'paid', 'cancelled', 'refunded');
create type payment_method as enum ('cash', 'transfer', 'qris', 'other');
create type employment_type as enum ('employee', 'freelance');
create type equipment_condition as enum ('excellent', 'good', 'fair', 'poor');
create type equipment_status as enum ('available', 'maintenance', 'unavailable', 'retired');
create type class_status as enum ('scheduled', 'ongoing', 'completed', 'cancelled');

-- ---------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  owner_id uuid not null references profiles(id),
  billing_email text,
  onboarding_step text not null default 'business', -- business | gym | branch | membership | complete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role org_role not null,
  invited_email text,
  status text not null default 'active', -- active | invited | disabled
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_org_users_user on organization_users(user_id);
create index idx_org_users_org on organization_users(organization_id);

-- ---------------------------------------------------------
-- GYMS
-- ---------------------------------------------------------
create table gyms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  logo_url text,
  contact_phone text,
  contact_email text,
  address text,
  timezone text not null default 'Asia/Jakarta',
  currency text not null default 'IDR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index idx_gyms_org on gyms(organization_id);

-- ---------------------------------------------------------
-- BRANCHES
-- ---------------------------------------------------------
create table branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  opening_hours jsonb not null default '{}'::jsonb,
  status branch_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index idx_branches_org on branches(organization_id);
create index idx_branches_gym on branches(gym_id);

create table branch_users (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (branch_id, user_id)
);
create index idx_branch_users_user on branch_users(user_id);
create index idx_branch_users_branch on branch_users(branch_id);

-- ---------------------------------------------------------
-- MEMBERS
-- ---------------------------------------------------------
create table members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id), -- home / registration branch
  member_code text not null,
  full_name text not null,
  phone text,
  email text,
  photo_url text,
  gender text,
  birth_date date,
  join_date date not null default current_date,
  status member_status not null default 'visitor',
  notes text,
  repup_account_id uuid, -- future link to RepUp consumer app account
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz,
  unique (organization_id, member_code)
);
create index idx_members_org on members(organization_id);
create index idx_members_branch on members(branch_id);
create index idx_members_status on members(status);
create index idx_members_name on members using gin (to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(phone,'') || ' ' || coalesce(email,'')));

-- ---------------------------------------------------------
-- MEMBERSHIP PLANS
-- ---------------------------------------------------------
create table membership_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  name text not null,
  description text,
  price numeric(14,2) not null default 0,
  duration_value integer not null default 1,
  duration_unit duration_unit not null default 'month',
  visit_limit integer, -- null = unlimited
  branch_access branch_access_type not null default 'all',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index idx_plans_org on membership_plans(organization_id);
create index idx_plans_gym on membership_plans(gym_id);

create table membership_plan_branches (
  plan_id uuid not null references membership_plans(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  primary key (plan_id, branch_id)
);

-- ---------------------------------------------------------
-- MEMBERSHIPS (instances) — never overwritten, full history kept
-- ---------------------------------------------------------
create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id),
  member_id uuid not null references members(id) on delete cascade,
  membership_plan_id uuid not null references membership_plans(id),
  start_date date not null,
  end_date date,
  status membership_status not null default 'pending',
  remaining_visits integer,
  payment_status payment_status not null default 'unpaid',
  transaction_id uuid, -- fk added after transactions table exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index idx_memberships_org on memberships(organization_id);
create index idx_memberships_member on memberships(member_id);
create index idx_memberships_branch on memberships(branch_id);
create index idx_memberships_status on memberships(status);

create table membership_events (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references memberships(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type membership_event_type not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index idx_membership_events_membership on membership_events(membership_id);

-- ---------------------------------------------------------
-- CHECK-INS
-- ---------------------------------------------------------
create table check_ins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id),
  member_id uuid not null references members(id) on delete cascade,
  membership_id uuid references memberships(id),
  occurred_at timestamptz not null default now(),
  method checkin_method not null default 'manual',
  status checkin_status not null,
  denial_reason text,
  validated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_checkins_org on check_ins(organization_id);
create index idx_checkins_branch on check_ins(branch_id);
create index idx_checkins_member on check_ins(member_id);
create index idx_checkins_occurred on check_ins(occurred_at desc);

-- ---------------------------------------------------------
-- PRODUCTS / CATEGORIES (POS catalog)
-- ---------------------------------------------------------
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  product_type product_type not null,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  category_id uuid references product_categories(id),
  product_type product_type not null,
  name text not null,
  sku text,
  price numeric(14,2) not null default 0,
  membership_plan_id uuid references membership_plans(id), -- link when product_type = membership/day_pass
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index idx_products_org on products(organization_id);
create index idx_products_gym on products(gym_id);

-- ---------------------------------------------------------
-- TRANSACTIONS / PAYMENTS
-- ---------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id),
  member_id uuid references members(id),
  invoice_number text not null,
  transaction_type transaction_type not null default 'sale',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  payment_method payment_method not null default 'cash',
  status transaction_status not null default 'pending',
  cashier_id uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_reason text,
  unique (organization_id, invoice_number)
);
create index idx_transactions_org on transactions(organization_id);
create index idx_transactions_branch on transactions(branch_id);
create index idx_transactions_member on transactions(member_id);
create index idx_transactions_created on transactions(created_at desc);

alter table memberships add constraint fk_memberships_transaction
  foreign key (transaction_id) references transactions(id);

create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  quantity integer not null default 1,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  membership_plan_id uuid references membership_plans(id),
  created_at timestamptz not null default now()
);
create index idx_txn_items_txn on transaction_items(transaction_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  amount numeric(14,2) not null,
  method payment_method not null,
  status transaction_status not null default 'paid',
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_payments_txn on payments(transaction_id);

-- ---------------------------------------------------------
-- TRAINERS
-- ---------------------------------------------------------
create table trainers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  user_id uuid references profiles(id), -- optional linked login
  full_name text not null,
  phone text,
  email text,
  photo_url text,
  specialization text,
  employment_type employment_type not null default 'freelance',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index idx_trainers_org on trainers(organization_id);

create table trainer_branches (
  trainer_id uuid not null references trainers(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  primary key (trainer_id, branch_id)
);

-- ---------------------------------------------------------
-- CLASSES
-- ---------------------------------------------------------
create table classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id),
  trainer_id uuid references trainers(id),
  name text not null,
  description text,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null default 20,
  price numeric(14,2) not null default 0,
  status class_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_classes_org on classes(organization_id);
create index idx_classes_branch on classes(branch_id);
create index idx_classes_date on classes(session_date);

create table class_participants (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  status text not null default 'booked', -- booked | attended | no_show | cancelled
  created_at timestamptz not null default now(),
  unique (class_id, member_id)
);

-- ---------------------------------------------------------
-- EQUIPMENT
-- ---------------------------------------------------------
create table equipment_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- e.g. barbell, dumbbell, cable_machine, smith_machine, leg_press, hack_squat, pull_up_bar, treadmill
  name text not null
);

create table equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  category_id uuid references equipment_categories(id),
  name text not null,
  brand text,
  model text,
  quantity integer not null default 1,
  condition equipment_condition not null default 'good',
  status equipment_status not null default 'available',
  purchase_date date,
  maintenance_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index idx_equipment_org on equipment(organization_id);
create index idx_equipment_branch on equipment(branch_id);

-- ---------------------------------------------------------
-- AUDIT LOG
-- ---------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_org on audit_logs(organization_id);
create index idx_audit_created on audit_logs(created_at desc);

-- ---------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['profiles','organizations','gyms','branches','members','membership_plans',
    'memberships','products','transactions','trainers','classes','equipment']
  loop
    execute format('create trigger trg_%I_updated_at before update on %I for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- Seed static equipment categories
insert into equipment_categories (slug, name) values
  ('barbell', 'Barbell'),
  ('dumbbell', 'Dumbbell'),
  ('cable_machine', 'Cable Machine'),
  ('smith_machine', 'Smith Machine'),
  ('leg_press', 'Leg Press'),
  ('hack_squat', 'Hack Squat'),
  ('pull_up_bar', 'Pull-up Bar'),
  ('treadmill', 'Treadmill'),
  ('bench', 'Bench'),
  ('kettlebell', 'Kettlebell'),
  ('rowing_machine', 'Rowing Machine'),
  ('stationary_bike', 'Stationary Bike');
