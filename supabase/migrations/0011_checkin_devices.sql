-- Check-in inputs and device metadata. Attendance remains in check_ins.
alter type checkin_method add value if not exists 'camera_qr';
alter type checkin_method add value if not exists 'usb_qr';
alter type checkin_method add value if not exists 'rfid';
alter type checkin_method add value if not exists 'nfc';
alter type checkin_method add value if not exists 'gate';

alter table check_ins
  add column if not exists source text not null default 'manual',
  add column if not exists device_id text,
  add column if not exists identifier_type text,
  add column if not exists request_id uuid;
create unique index if not exists idx_checkins_request_id on check_ins(request_id) where request_id is not null;

create table if not exists member_checkin_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index if not exists idx_member_checkin_tokens_member on member_checkin_tokens(member_id);

create table if not exists rfid_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  uid_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'disabled')),
  issued_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_rfid_cards_member on rfid_cards(member_id);

create table if not exists gym_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  gym_id uuid not null references gyms(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  type text not null check (type in ('camera', 'qr_hid', 'barcode_hid', 'rfid_hid', 'rfid_serial', 'nfc', 'turnstile', 'door_controller')),
  connection_type text not null check (connection_type in ('browser_camera', 'keyboard_hid', 'web_serial', 'web_usb', 'local_connector', 'network')),
  external_device_id text,
  status text not null default 'not_configured' check (status in ('online', 'offline', 'not_configured', 'disabled')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gym_devices_branch on gym_devices(branch_id, status);

alter table member_checkin_tokens enable row level security;
alter table rfid_cards enable row level security;
alter table gym_devices enable row level security;

create policy "member_checkin_tokens_select" on member_checkin_tokens for select using (is_org_member(organization_id));
create policy "member_checkin_tokens_manage" on member_checkin_tokens for all using (is_org_wide(organization_id)) with check (is_org_wide(organization_id));
create policy "rfid_cards_select" on rfid_cards for select using (has_branch_access((select branch_id from members where id = member_id)));
create policy "rfid_cards_manage" on rfid_cards for all using (is_org_wide(organization_id)) with check (is_org_wide(organization_id));
create policy "gym_devices_select" on gym_devices for select using (has_branch_access(branch_id));
create policy "gym_devices_manage" on gym_devices for all using (is_org_wide(organization_id)) with check (is_org_wide(organization_id));
