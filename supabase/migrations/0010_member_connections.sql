-- RepUp Business member connections: safe, forward-only additions.
alter table members
  add column if not exists address text,
  add column if not exists emergency_contact text,
  add constraint members_repup_account_fk
  foreign key (repup_account_id) references profiles(id) on delete set null;

create unique index if not exists idx_members_org_repup_account
  on members (organization_id, repup_account_id)
  where repup_account_id is not null;

create table if not exists member_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (code)
);
create index if not exists idx_member_pairing_member on member_pairing_codes(member_id, created_at desc);
create index if not exists idx_member_pairing_active_member
  on member_pairing_codes(member_id, expires_at desc)
  where used_at is null;

create table if not exists member_join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  matched_member_id uuid references members(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id),
  unique (id)
);
create index if not exists idx_member_join_requests_org on member_join_requests(organization_id, status, requested_at desc);
create unique index if not exists idx_member_join_requests_pending_user
  on member_join_requests(organization_id, user_id)
  where status = 'pending';

alter table member_pairing_codes enable row level security;
alter table member_join_requests enable row level security;

create policy "member_pairing_select" on member_pairing_codes
  for select using (has_branch_access(branch_id));
create policy "member_pairing_insert" on member_pairing_codes
  for insert with check (has_branch_access(branch_id));
create policy "member_pairing_update" on member_pairing_codes
  for update using (has_branch_access(branch_id)) with check (has_branch_access(branch_id));

create policy "member_join_requests_select" on member_join_requests
  for select using (has_branch_access(branch_id));
create policy "member_join_requests_insert" on member_join_requests
  for insert with check (has_branch_access(branch_id) and user_id = auth.uid());
create policy "member_join_requests_update" on member_join_requests
  for update using (has_branch_access(branch_id)) with check (has_branch_access(branch_id));

create policy "profiles_linked_member_read" on profiles for select using (
  exists (
    select 1 from members m
    where m.repup_account_id = profiles.id
      and is_org_member(m.organization_id)
  )
);

create policy "profiles_join_request_read" on profiles for select using (
  exists (
    select 1 from member_join_requests r
    where r.user_id = profiles.id
      and r.status = 'pending'
      and has_branch_access(r.branch_id)
  )
);
