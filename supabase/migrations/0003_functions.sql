-- =========================================================
-- RepUp Gym — Business logic functions (SECURITY DEFINER RPCs)
-- Keeps critical, sensitive operations server-side & atomic.
-- =========================================================

alter table branches add column if not exists code text;
update branches set code = upper(left(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'), 3)) where code is null;
alter table branches alter column code set not null;

create sequence if not exists invoice_seq;

create or replace function generate_invoice_number(p_branch_id uuid)
returns text as $$
declare
  v_code text;
  v_seq bigint;
begin
  select code into v_code from branches where id = p_branch_id;
  v_seq := nextval('invoice_seq');
  return 'RPU-' || coalesce(v_code, 'GEN') || '-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq::text, 6, '0');
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------
-- POS CHECKOUT: creates transaction + items + payment,
-- and if a membership plan is purchased, activates the membership.
-- Runs atomically so partial writes never occur.
-- ---------------------------------------------------------
create or replace function pos_checkout(
  p_organization_id uuid,
  p_gym_id uuid,
  p_branch_id uuid,
  p_member_id uuid,
  p_items jsonb, -- [{product_id, description, quantity, unit_price, membership_plan_id}]
  p_discount numeric,
  p_tax numeric,
  p_payment_method payment_method
)
returns table (transaction_id uuid, invoice_number text) as $$
declare
  v_txn_id uuid;
  v_invoice text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_line_total numeric;
  v_txn_type transaction_type := 'sale';
  v_plan record;
  v_membership_id uuid;
begin
  if not has_branch_access(p_branch_id) then
    raise exception 'Not authorized for this branch';
  end if;

  select coalesce(sum((i->>'quantity')::int * (i->>'unit_price')::numeric), 0)
  into v_subtotal
  from jsonb_array_elements(p_items) i;

  v_total := greatest(v_subtotal - coalesce(p_discount,0) + coalesce(p_tax,0), 0);
  v_invoice := generate_invoice_number(p_branch_id);

  if exists (select 1 from jsonb_array_elements(p_items) i where i->>'membership_plan_id' is not null) then
    v_txn_type := 'membership_purchase';
  end if;

  insert into transactions (
    organization_id, gym_id, branch_id, member_id, invoice_number, transaction_type,
    subtotal, discount, tax, total, payment_method, status, cashier_id
  ) values (
    p_organization_id, p_gym_id, p_branch_id, p_member_id, v_invoice, v_txn_type,
    v_subtotal, coalesce(p_discount,0), coalesce(p_tax,0), v_total, p_payment_method, 'paid', auth.uid()
  ) returning id into v_txn_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::int * (v_item->>'unit_price')::numeric;

    insert into transaction_items (
      transaction_id, product_id, description, quantity, unit_price, total, membership_plan_id
    ) values (
      v_txn_id,
      nullif(v_item->>'product_id','')::uuid,
      v_item->>'description',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      v_line_total,
      nullif(v_item->>'membership_plan_id','')::uuid
    );

    -- Auto-activate membership when this line item is a membership/day-pass plan purchase
    if (v_item->>'membership_plan_id') is not null and p_member_id is not null then
      select * into v_plan from membership_plans where id = (v_item->>'membership_plan_id')::uuid;

      insert into memberships (
        organization_id, gym_id, branch_id, member_id, membership_plan_id,
        start_date, end_date, status, remaining_visits, payment_status, transaction_id, created_by
      ) values (
        p_organization_id, p_gym_id, p_branch_id, p_member_id, v_plan.id,
        current_date,
        case
          when v_plan.duration_unit = 'day' then current_date + (v_plan.duration_value || ' days')::interval
          when v_plan.duration_unit = 'month' then current_date + (v_plan.duration_value || ' months')::interval
          when v_plan.duration_unit = 'year' then current_date + (v_plan.duration_value || ' years')::interval
          else null
        end,
        'active',
        v_plan.visit_limit,
        'paid',
        v_txn_id,
        auth.uid()
      ) returning id into v_membership_id;

      insert into membership_events (membership_id, organization_id, event_type, notes, created_by)
      values (v_membership_id, p_organization_id, 'activated', 'Activated via POS sale ' || v_invoice, auth.uid());

      update members set status = 'active' where id = p_member_id;
    end if;
  end loop;

  insert into payments (transaction_id, organization_id, amount, method, status)
  values (v_txn_id, p_organization_id, v_total, p_payment_method, 'paid');

  insert into audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_organization_id, auth.uid(), 'transaction.created', 'transaction', v_txn_id,
          jsonb_build_object('invoice_number', v_invoice, 'total', v_total));

  return query select v_txn_id, v_invoice;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------
-- CHECK-IN VALIDATION
-- Enforces: membership exists -> active -> branch access -> not expired
-- -> visit limit -> duplicate check-in window
-- ---------------------------------------------------------
create or replace function perform_check_in(
  p_member_id uuid,
  p_branch_id uuid,
  p_method checkin_method default 'manual',
  p_duplicate_window_minutes int default 30
)
returns table (
  result_status checkin_status,
  denial_reason text,
  membership_id uuid,
  member_name text,
  plan_name text,
  valid_until date,
  branch_name text
) as $$
declare
  v_org_id uuid;
  v_gym_id uuid;
  v_member record;
  v_membership record;
  v_last_checkin timestamptz;
  v_status checkin_status;
  v_reason text;
begin
  if not has_branch_access(p_branch_id) then
    raise exception 'Not authorized for this branch';
  end if;

  select b.organization_id, b.gym_id into v_org_id, v_gym_id from branches b where b.id = p_branch_id;
  select * into v_member from members m where m.id = p_member_id and m.organization_id = v_org_id;

  if v_member is null then
    v_status := 'denied'; v_reason := 'Member not found in this organization.';
  else
    select ts.occurred_at into v_last_checkin
    from check_ins ts
    where ts.member_id = p_member_id and ts.status = 'success'
    order by ts.occurred_at desc limit 1;

    if v_last_checkin is not null and v_last_checkin > now() - (p_duplicate_window_minutes || ' minutes')::interval then
      v_status := 'denied'; v_reason := 'Duplicate check-in: member already checked in recently.';
    else
      -- most relevant active membership, preferring ones granting access to this branch
      select m.*, mp.name as plan_name, mp.branch_access
      into v_membership
      from memberships m
      join membership_plans mp on mp.id = m.membership_plan_id
      where m.member_id = p_member_id
        and m.status in ('active','expiring_soon')
      order by m.end_date desc nulls last
      limit 1;

      if v_membership is null then
        v_status := 'denied'; v_reason := 'No active membership found.';
      elsif v_membership.end_date is not null and v_membership.end_date < current_date then
        update memberships set status = 'expired' where id = v_membership.id;
        v_status := 'denied'; v_reason := 'Membership expired.';
      elsif v_membership.remaining_visits is not null and v_membership.remaining_visits <= 0 then
        v_status := 'denied'; v_reason := 'Visit limit reached for this membership.';
      elsif v_membership.branch_access = 'single' and v_membership.branch_id <> p_branch_id then
        v_status := 'denied'; v_reason := 'Membership does not include this branch.';
      elsif v_membership.branch_access = 'selected' and not exists (
        select 1 from membership_plan_branches pb
        where pb.plan_id = v_membership.membership_plan_id and pb.branch_id = p_branch_id
      ) then
        v_status := 'denied'; v_reason := 'Membership does not include this branch.';
      else
        v_status := 'success'; v_reason := null;
        if v_membership.remaining_visits is not null then
          update memberships set remaining_visits = remaining_visits - 1 where id = v_membership.id;
        end if;
        update members set status = 'active' where id = p_member_id;
      end if;
    end if;
  end if;

  insert into check_ins (
    organization_id, gym_id, branch_id, member_id, membership_id, method, status, denial_reason, validated_by
  ) values (
    v_org_id, v_gym_id, p_branch_id, p_member_id,
    case when v_status = 'success' then v_membership.id else v_membership.id end,
    p_method, v_status, v_reason, auth.uid()
  );

  return query select
    v_status,
    v_reason,
    v_membership.id,
    v_member.full_name,
    v_membership.plan_name,
    v_membership.end_date,
    (select b.name from branches b where b.id = p_branch_id);
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------
-- Nightly-style refresh function for membership statuses
-- (call periodically via scheduled job / Edge Function cron)
-- ---------------------------------------------------------
create or replace function refresh_membership_statuses()
returns void as $$
begin
  update memberships set status = 'expired'
  where status in ('active','expiring_soon') and end_date is not null and end_date < current_date;

  update memberships set status = 'expiring_soon'
  where status = 'active' and end_date is not null
    and end_date >= current_date and end_date <= current_date + interval '7 days';

  update members m set status = 'expired'
  where m.status = 'active'
    and not exists (
      select 1 from memberships ms
      where ms.member_id = m.id and ms.status in ('active','expiring_soon')
    );
end;
$$ language plpgsql security definer set search_path = public;
