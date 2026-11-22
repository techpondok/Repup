"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { getTenantContext } from "@/lib/tenant";

export interface CartItem {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  membership_plan_id?: string | null;
}

export type CheckoutResult = { error?: string; invoice_number?: string; transaction_id?: string };

export async function checkoutSale(params: {
  organization_id: string;
  gym_id: string;
  branch_id: string;
  member_id: string | null;
  items: CartItem[];
  discount: number;
  tax: number;
  payment_method: "cash" | "transfer" | "qris" | "other";
  request_id: string;
  cash_tendered: number | null;
}): Promise<CheckoutResult> {
  const ctx = await requirePermission("pos.use");
  if (ctx.isDemo || ctx.organization.id !== params.organization_id ||
      !ctx.branches.some(branch => branch.id === params.branch_id && branch.gym_id === params.gym_id)) {
    return { error: "Akses kasir ditolak untuk cabang ini." };
  }
  if (!params.items?.length) return { error: "Keranjang kosong." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_checkout_receipt", {
    p_organization_id: params.organization_id,
    p_gym_id: params.gym_id,
    p_branch_id: params.branch_id,
    p_member_id: params.member_id,
    p_items: params.items,
    p_discount: params.discount,
    p_tax: params.tax,
    p_payment_method: params.payment_method,
    p_request_id: params.request_id,
    p_cash_tendered: params.cash_tendered,
  });

  if (error) {
    console.error("[POS][CHECKOUT]", error.code, error.message);
    return { error: "Pembayaran gagal dicatat. Periksa pilihan member, harga, dan nominal, lalu coba lagi." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/members");
  revalidatePath("/memberships");

  return { invoice_number: row.invoice_number, transaction_id: row.transaction_id };
}

export async function searchMembersForPos(organizationId: string, branchId: string, q: string) {
  const ctx = await requirePermission("pos.use");
  if (ctx.isDemo || ctx.organization.id !== organizationId || !ctx.branches.some(branch => branch.id === branchId)) return [];
  const supabase = await createClient();
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const pattern = `%${term.replace(/[\\%_*]/g, "\\$&")}%`;
  const results = await Promise.all(["full_name", "member_code", "phone"].map(column => supabase
    .from("members").select("id, full_name, member_code, phone")
    .eq("organization_id", organizationId).eq("branch_id", branchId).neq("status", "archived")
    .ilike(column, pattern).order("full_name").limit(8)));
  if (results.some(result => result.error)) throw new Error("Member search failed.");
  return [...new Map(results.flatMap(result => result.data ?? []).map(member => [member.id, member])).values()].slice(0, 8);
}

export async function changeTransactionMember(transactionId: string, expectedMemberId: string | null, _previous: { error?: string } | null, formData: FormData) {
  const ctx = await getTenantContext();
  if (ctx.isDemo || !ctx.isOrgWide) return { error: "Only organization owners or admins can change the customer." };
  const supabase = await createClient();
  const { data: transaction } = await supabase.from("transactions").select("id,branch_id,transaction_type,member_id")
    .eq("organization_id", ctx.organization.id).eq("id", transactionId).maybeSingle();
  if (!transaction || transaction.transaction_type !== "sale") return { error: "This transaction cannot be reassigned." };
  const code = String(formData.get("memberCode") ?? "").trim();
  let memberId: string | null = null;
  if (code) {
    const { data: member } = await supabase.from("members").select("id").eq("organization_id", ctx.organization.id)
      .eq("branch_id", transaction.branch_id).eq("member_code", code).neq("status", "archived").maybeSingle();
    if (!member) return { error: "No active customer with that member number was found at this branch." };
    memberId = member.id;
  }
  let update = supabase.from("transactions").update({ member_id: memberId }).eq("id", transaction.id).eq("organization_id", ctx.organization.id);
  update = expectedMemberId ? update.eq("member_id", expectedMemberId) : update.is("member_id", null);
  const { data, error } = await update.select("id").maybeSingle();
  if (error || !data) return { error: "Customer could not be updated. Refresh and try again." };
  revalidatePath(`/transactions/${transaction.id}`);
  revalidatePath("/transactions");
  if (transaction.member_id) revalidatePath(`/members/${transaction.member_id}`);
  if (memberId) revalidatePath(`/members/${memberId}`);
  return {};
}
