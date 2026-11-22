import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-bits";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { LinkButton } from "@/components/ui/button";
import { StoreStaffBoundary } from "@/components/store/staff-boundary";
import { CashierStore } from "@/components/store/cashier-store";

const CATEGORY_LABEL: Record<string, string> = {
  membership: "Membership",
  day_pass: "Day Pass",
  personal_training: "Personal Training",
  class: "Kelas",
  merchandise: "Merchandise",
  supplement: "Suplemen",
  other: "Lainnya",
};

export default async function PosPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const ctx = await getTenantContext();
  const requestedMember = (await searchParams).member;
  if (ctx.isDemo) return <StoreStaffBoundary mode="cashier"><CashierStore key={requestedMember} initialMemberId={requestedMember} /></StoreStaffBoundary>;

  if (!ctx.branch) {
    return <EmptyState title="Belum ada cabang" description="Buat cabang terlebih dahulu untuk menggunakan kasir." />;
  }

  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, name, price, duration_unit")
    .eq("organization_id", ctx.organization.id)
    .eq("gym_id", ctx.branch.gym_id)
    .eq("is_active", true);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, product_type")
    .eq("organization_id", ctx.organization.id)
    .eq("gym_id", ctx.branch.gym_id)
    .eq("is_active", true);

  const { data: initialMember } = typeof requestedMember === "string" && /^[a-f0-9-]{36}$/i.test(requestedMember)
    ? await supabase.from("members").select("id, full_name, member_code, phone").eq("id", requestedMember).eq("organization_id", ctx.organization.id).eq("branch_id", ctx.branch.id).neq("status", "archived").maybeSingle()
    : { data: null };

  const gym = ctx.gyms.find((g) => g.id === ctx.branch!.gym_id);

  const planItems = (plans ?? []).map((p) => ({
    id: `plan-${p.id}`,
    name: p.name,
    price: p.price,
    category: p.duration_unit === "visit" ? CATEGORY_LABEL.day_pass : CATEGORY_LABEL.membership,
    membership_plan_id: p.id,
  }));

  const productItems = (products ?? []).map((p) => ({
    id: `product-${p.id}`,
    name: p.name,
    price: p.price,
    category: CATEGORY_LABEL[p.product_type] ?? "Lainnya",
    product_id: p.id,
  }));

  const items = [...planItems, ...productItems];

  return (
    <div>
      <PageHeader
        title="Kasir"
        description={`Transaksi untuk ${ctx.branch.name}`}
        actions={
          items.length === 0 ? (
            <LinkButton href="/memberships/new" variant="secondary">
              Buat Paket Membership
            </LinkButton>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="Belum ada item untuk dijual"
          description="Buat paket membership terlebih dahulu agar dapat dijual melalui kasir."
          action={<LinkButton href="/memberships/new">Buat Paket Membership</LinkButton>}
        />
      ) : (
        <PosTerminal
          key={initialMember?.id ?? ctx.branch.id}
          initialMember={initialMember}
          organizationId={ctx.organization.id}
          gymId={ctx.branch.gym_id}
          branchId={ctx.branch.id}
          items={items}
          currency={gym?.currency ?? "IDR"}
        />
      )}
    </div>
  );
}
