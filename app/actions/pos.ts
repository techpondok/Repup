"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";

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
}): Promise<CheckoutResult> {
  await requirePermission("pos.use");
  if (!params.items.length) return { error: "Keranjang kosong." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pos_checkout", {
    p_organization_id: params.organization_id,
    p_gym_id: params.gym_id,
    p_branch_id: params.branch_id,
    p_member_id: params.member_id,
    p_items: params.items,
    p_discount: params.discount,
    p_tax: params.tax,
    p_payment_method: params.payment_method,
  });

  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/members");
  revalidatePath("/memberships");

  return { invoice_number: row.invoice_number, transaction_id: row.transaction_id };
}

export async function searchMembersForPos(organizationId: string, branchId: string, q: string) {
  await requirePermission("pos.use");
  const supabase = await createClient();
  if (!q.trim()) return [];
  const { data } = await supabase
    .from("members")
    .select("id, full_name, member_code, phone")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%`)
    .limit(8);
  return data ?? [];
}
