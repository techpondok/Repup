-- Keep the receipt snapshot even when a catalog entry is removed.
alter table public.transaction_items
  add column if not exists product_sku text,
  add column if not exists is_physical_product boolean not null default false;

update public.transaction_items i
set product_sku = p.sku,
    is_physical_product = p.product_type in ('merchandise', 'supplement', 'other')
from public.products p
where i.product_id = p.id;

alter table public.transaction_items
  drop constraint transaction_items_product_id_fkey,
  add constraint transaction_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

create or replace function public.snapshot_pos_product()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.product_sku := null;
  new.is_physical_product := false;
  if new.product_id is not null then
    select p.sku, p.product_type in ('merchandise', 'supplement', 'other')
    into new.product_sku, new.is_physical_product
    from public.products p
    join public.transactions t on t.id = new.transaction_id
    where p.id = new.product_id and p.organization_id = t.organization_id and p.gym_id = t.gym_id;
    if not found then
      raise exception 'Invalid product for this transaction';
    end if;
  end if;
  return new;
end;
$$;

create trigger snapshot_pos_product before insert on public.transaction_items
for each row execute function public.snapshot_pos_product();

alter table public.transactions
  add column if not exists checkout_request_id uuid,
  add column if not exists checkout_fingerprint text,
  add column if not exists cash_tendered numeric(14,2);

create or replace function public.guard_transaction_member()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and (new.checkout_request_id is not null or new.checkout_fingerprint is not null or new.cash_tendered is not null) then
      raise exception 'Receipt payment fields are set by POS checkout';
    elsif tg_op = 'UPDATE' and (new.checkout_request_id, new.checkout_fingerprint, new.cash_tendered) is distinct from
      (old.checkout_request_id, old.checkout_fingerprint, old.cash_tendered) then
      raise exception 'Receipt payment fields are set by POS checkout';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and (new.status = 'refunded' or old.status = 'refunded')
       and not coalesce(public.org_role(old.organization_id) in ('owner', 'admin'), false) then
      raise exception 'Refund requires organization owner or admin access';
    end if;
    if (new.organization_id, new.gym_id, new.branch_id) is distinct from
       (old.organization_id, old.gym_id, old.branch_id) then
      raise exception 'Transaction scope cannot change';
    end if;
    if new.member_id is not distinct from old.member_id then
      return new;
    end if;
    if auth.uid() is null or not coalesce(public.org_role(old.organization_id) in ('owner', 'admin'), false) then
      raise exception 'Only organization owners or admins can change the transaction member';
    end if;
    if exists (select 1 from public.memberships m where m.transaction_id = old.id)
       or old.transaction_type = 'membership_purchase' then
      raise exception 'A membership purchase cannot be reassigned';
    end if;
    insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, metadata)
    values (old.organization_id, auth.uid(), 'transaction.member_changed', 'transaction', old.id,
      jsonb_build_object('old_member_id', old.member_id, 'new_member_id', new.member_id));
  end if;
  if not exists (
    select 1 from public.branches b where b.id = new.branch_id
      and b.organization_id = new.organization_id and b.gym_id = new.gym_id
  ) then
    raise exception 'Invalid transaction branch';
  end if;
  if new.member_id is not null and not exists (
    select 1 from public.members m where m.id = new.member_id and m.organization_id = new.organization_id
      and m.gym_id = new.gym_id and m.branch_id = new.branch_id and m.status <> 'archived'
  ) then
    raise exception 'Invalid member for this branch';
  end if;
  return new;
end;
$$;

create trigger guard_transaction_member before insert or update of member_id, organization_id, gym_id, branch_id, status,
  checkout_request_id, checkout_fingerprint, cash_tendered
on public.transactions for each row execute function public.guard_transaction_member();

create unique index if not exists idx_transactions_checkout_request
on public.transactions(organization_id, checkout_request_id) where checkout_request_id is not null;

alter function public.pos_checkout(uuid,uuid,uuid,uuid,jsonb,numeric,numeric,public.payment_method)
  rename to pos_checkout_core;
revoke execute on function public.pos_checkout_core(uuid,uuid,uuid,uuid,jsonb,numeric,numeric,public.payment_method)
from public, anon, authenticated;

create or replace function public.pos_checkout_receipt(
  p_organization_id uuid, p_gym_id uuid, p_branch_id uuid, p_member_id uuid,
  p_items jsonb, p_discount numeric, p_tax numeric, p_payment_method public.payment_method,
  p_request_id uuid, p_cash_tendered numeric
) returns table(transaction_id uuid, invoice_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_plan_id uuid;
  v_price numeric;
  v_name text;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_transaction_id uuid;
  v_invoice_number text;
  v_fingerprint text;
  v_previous_fingerprint text;
begin
  select ou.role::text into v_role from public.organization_users ou
  where ou.organization_id = p_organization_id and ou.user_id = auth.uid() and ou.status = 'active';
  if auth.uid() is null or not coalesce(public.has_branch_access(p_branch_id), false)
     or not (coalesce(v_role in ('owner', 'admin'), false) or exists (
       select 1 from public.role_permissions rp where rp.role = v_role and rp.permission_code = 'pos.use'
     )) or not exists (
       select 1 from public.branches b where b.id = p_branch_id and b.organization_id = p_organization_id and b.gym_id = p_gym_id
     ) then
    raise exception 'POS access denied for this branch';
  end if;
  if p_request_id is null then raise exception 'Checkout request is required'; end if;
  v_fingerprint := md5(jsonb_build_array(p_gym_id, p_branch_id, p_member_id, p_items, p_discount, p_tax, p_payment_method, p_cash_tendered)::text);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_request_id::text, 0));
  select t.id, t.invoice_number, t.checkout_fingerprint into v_transaction_id, v_invoice_number, v_previous_fingerprint
  from public.transactions t where t.organization_id = p_organization_id and t.checkout_request_id = p_request_id
    and t.branch_id = p_branch_id and t.cashier_id = auth.uid();
  if found then
    if v_fingerprint is distinct from v_previous_fingerprint then raise exception 'Checkout request has already been used'; end if;
    return query select v_transaction_id, v_invoice_number;
    return;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100
     or p_payment_method is null or p_discount is null or p_discount < 0 or p_tax is distinct from 0 then
    raise exception 'Invalid checkout';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_plan_id := nullif(v_item->>'membership_plan_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity not between 1 and 999 or (v_product_id is null) = (v_plan_id is null) then
      raise exception 'Invalid checkout item';
    end if;
    if v_plan_id is not null then
      if p_member_id is null or v_quantity <> 1 then raise exception 'Membership requires a member and quantity of one'; end if;
      select p.name, p.price into v_name, v_price from public.membership_plans p
      where p.id = v_plan_id and p.organization_id = p_organization_id and p.gym_id = p_gym_id and p.is_active;
    else
      select p.name, p.price into v_name, v_price from public.products p
      where p.id = v_product_id and p.organization_id = p_organization_id and p.gym_id = p_gym_id and p.is_active and p.archived_at is null;
    end if;
    if not found or v_price < 0 or v_price is distinct from (v_item->>'unit_price')::numeric then
      raise exception 'A price or item has changed';
    end if;
    v_subtotal := v_subtotal + v_price * v_quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'membership_plan_id', v_plan_id,
      'description', v_name, 'quantity', v_quantity, 'unit_price', v_price));
  end loop;
  if p_discount > v_subtotal or (p_cash_tendered is not null and
     (p_payment_method <> 'cash' or p_cash_tendered < v_subtotal - p_discount or p_cash_tendered >= 1000000000000)) then
    raise exception 'Invalid discount or cash amount';
  end if;
  select r.transaction_id, r.invoice_number into v_transaction_id, v_invoice_number
  from public.pos_checkout_core(p_organization_id, p_gym_id, p_branch_id, p_member_id, v_items, p_discount, p_tax, p_payment_method) r;
  update public.transactions t set checkout_request_id = p_request_id, checkout_fingerprint = v_fingerprint,
    cash_tendered = case when p_payment_method = 'cash' then coalesce(p_cash_tendered, v_subtotal - p_discount) end
  where t.id = v_transaction_id;
  return query select v_transaction_id, v_invoice_number;
end;
$$;

revoke execute on function public.pos_checkout_receipt(uuid,uuid,uuid,uuid,jsonb,numeric,numeric,public.payment_method,uuid,numeric) from public, anon;
grant execute on function public.pos_checkout_receipt(uuid,uuid,uuid,uuid,jsonb,numeric,numeric,public.payment_method,uuid,numeric) to authenticated;

-- Existing clients use the same checks during rollout.
create function public.pos_checkout(
  p_organization_id uuid, p_gym_id uuid, p_branch_id uuid, p_member_id uuid,
  p_items jsonb, p_discount numeric, p_tax numeric, p_payment_method public.payment_method
) returns table(transaction_id uuid, invoice_number text)
language sql set search_path = '' as $$
  select * from public.pos_checkout_receipt(p_organization_id, p_gym_id, p_branch_id, p_member_id,
    p_items, p_discount, p_tax, p_payment_method, gen_random_uuid(), null);
$$;
revoke execute on function public.pos_checkout(uuid,uuid,uuid,uuid,jsonb,numeric,numeric,public.payment_method) from public, anon;
grant execute on function public.pos_checkout(uuid,uuid,uuid,uuid,jsonb,numeric,numeric,public.payment_method) to authenticated;

create or replace function public.guard_pos_refund()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'refunded' or (tg_op = 'UPDATE' and old.status = 'refunded') then
    if not coalesce(public.org_role(new.organization_id) in ('owner', 'admin'), false)
       or not exists (
         select 1 from public.transactions t where t.id = new.transaction_id and t.organization_id = new.organization_id
       ) then
      raise exception 'Refund requires organization owner or admin access';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_pos_refund before insert or update on public.payments
for each row execute function public.guard_pos_refund();
