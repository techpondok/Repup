-- =========================================================
-- RepUp Gym — Onboarding RPC
-- Atomically creates Organization -> Owner membership -> Gym -> Branch
-- =========================================================

create or replace function onboard_create_business(
  p_org_name text,
  p_gym_name text,
  p_branch_name text,
  p_branch_address text default null,
  p_branch_phone text default null,
  p_currency text default 'IDR',
  p_timezone text default 'Asia/Jakarta'
)
returns table (organization_id uuid, gym_id uuid, branch_id uuid) as $$
declare
  v_org_id uuid;
  v_gym_id uuid;
  v_branch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into organizations (name, owner_id, onboarding_step)
  values (p_org_name, auth.uid(), 'gym')
  returning id into v_org_id;

  insert into organization_users (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  insert into gyms (organization_id, name, currency, timezone)
  values (v_org_id, p_gym_name, p_currency, p_timezone)
  returning id into v_gym_id;

  insert into branches (organization_id, gym_id, name, address, phone)
  values (v_org_id, v_gym_id, p_branch_name, p_branch_address, p_branch_phone)
  returning id into v_branch_id;

  insert into branch_users (branch_id, organization_id, user_id)
  values (v_branch_id, v_org_id, auth.uid());

  update organizations set onboarding_step = 'membership' where id = v_org_id;

  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id)
  values (v_org_id, auth.uid(), 'organization.created', 'organization', v_org_id);

  return query select v_org_id, v_gym_id, v_branch_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function complete_onboarding(p_organization_id uuid)
returns void as $$
begin
  if not is_org_wide(p_organization_id) then
    raise exception 'Not authorized';
  end if;
  update organizations set onboarding_step = 'complete' where id = p_organization_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Next member_code helper (per-organization sequential code, e.g. M-000123)
create or replace function next_member_code(p_organization_id uuid)
returns text as $$
declare
  v_count int;
begin
  select count(*) into v_count from members where organization_id = p_organization_id;
  return 'M-' || lpad((v_count + 1)::text, 6, '0');
end;
$$ language plpgsql security definer set search_path = public;
