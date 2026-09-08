"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authorization";

export type ActionResult = { error?: string; id?: string };

export async function createPlan(formData: FormData): Promise<ActionResult> {
  await requirePermission("membership.sell");
  const supabase = await createClient();

  const organization_id = String(formData.get("organization_id") || "");
  const gym_id = String(formData.get("gym_id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const price = Number(formData.get("price") || 0);
  const duration_value = Number(formData.get("duration_value") || 1);
  const duration_unit = String(formData.get("duration_unit") || "month");
  const visit_limit = formData.get("visit_limit") ? Number(formData.get("visit_limit")) : null;
  const branch_access = String(formData.get("branch_access") || "all");
  const selected_branches = formData.getAll("branch_ids") as string[];

  if (!name || !organization_id || !gym_id) return { error: "Nama paket wajib diisi." };

  const { data, error } = await supabase
    .from("membership_plans")
    .insert({
      organization_id,
      gym_id,
      name,
      description,
      price,
      duration_value,
      duration_unit,
      visit_limit,
      branch_access,
    } as any)
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (branch_access === "selected" && selected_branches.length) {
    await supabase.from("membership_plan_branches").insert(
      selected_branches.map((branch_id) => ({ plan_id: (data as any).id, branch_id })) as any
    );
  }

  revalidatePath("/memberships");
  return { id: (data as any).id };
}

export async function togglePlanActive(planId: string, isActive: boolean) {
  await requirePermission("membership.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("membership_plans").update({ is_active: isActive } as any).eq("id", planId);
  if (error) return { error: error.message };
  revalidatePath("/memberships");
  return {};
}

async function logEvent(membershipId: string, orgId: string, type: string, notes: string) {
  const supabase = await createClient();
  await supabase.from("membership_events").insert({
    membership_id: membershipId,
    organization_id: orgId,
    event_type: type,
    notes,
  } as any);
}

export async function freezeMembership(membershipId: string, organizationId: string) {
  await requirePermission("membership.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ status: "frozen" } as any).eq("id", membershipId);
  if (error) return { error: error.message };
  await logEvent(membershipId, organizationId, "frozen", "Membership dibekukan oleh staff.");
  revalidatePath("/memberships");
  return {};
}

export async function unfreezeMembership(membershipId: string, organizationId: string) {
  await requirePermission("membership.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ status: "active" } as any).eq("id", membershipId);
  if (error) return { error: error.message };
  await logEvent(membershipId, organizationId, "unfrozen", "Membership diaktifkan kembali.");
  revalidatePath("/memberships");
  return {};
}

export async function cancelMembership(membershipId: string, organizationId: string) {
  await requirePermission("membership.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ status: "cancelled" } as any).eq("id", membershipId);
  if (error) return { error: error.message };
  await logEvent(membershipId, organizationId, "cancelled", "Membership dibatalkan oleh staff.");
  revalidatePath("/memberships");
  return {};
}

export async function extendMembership(membershipId: string, organizationId: string, extraDays: number) {
  await requirePermission("membership.manage");
  const supabase = await createClient();
  const { data: membership } = await supabase.from("memberships").select("end_date").eq("id", membershipId).single();
  if (!membership) return { error: "Membership tidak ditemukan." };

  const base = membership.end_date ? new Date(membership.end_date) : new Date();
  base.setDate(base.getDate() + extraDays);

  const { error } = await supabase
    .from("memberships")
    .update({ end_date: base.toISOString().slice(0, 10) } as any)
    .eq("id", membershipId);
  if (error) return { error: error.message };
  await logEvent(membershipId, organizationId, "extended", `Diperpanjang ${extraDays} hari.`);
  revalidatePath("/memberships");
  return {};
}
