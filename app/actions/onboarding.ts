"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ActionResult = { error?: string; data?: any };

export async function createBusiness(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir. Silakan masuk kembali." };

  const org_name = String(formData.get("org_name") || "").trim();
  const gym_name = String(formData.get("gym_name") || "").trim();
  const branch_name = String(formData.get("branch_name") || "").trim();
  const branch_address = String(formData.get("branch_address") || "").trim();
  const branch_phone = String(formData.get("branch_phone") || "").trim();

  if (!org_name || !gym_name || !branch_name) {
    return { error: "Nama bisnis, gym, dan cabang wajib diisi." };
  }

  const { data, error } = await supabase.rpc("onboard_create_business", {
    p_org_name: org_name,
    p_gym_name: gym_name,
    p_branch_name: branch_name,
    p_branch_address: branch_address || null,
    p_branch_phone: branch_phone || null,
    p_currency: "IDR",
    p_timezone: "Asia/Jakarta",
  });

  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  const cookieStore = await cookies();
  cookieStore.set("ru_org_id", row.organization_id, { path: "/", httpOnly: false });
  cookieStore.set("ru_branch_id", row.branch_id, { path: "/", httpOnly: false });

  return { data: row };
}

export async function createFirstMembershipPlan(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") || "");
  const gym_id = String(formData.get("gym_id") || "");
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price") || 0);
  const duration_value = Number(formData.get("duration_value") || 1);
  const duration_unit = String(formData.get("duration_unit") || "month");

  if (!name || !organization_id || !gym_id) return { error: "Nama paket wajib diisi." };

  const { error } = await supabase.from("membership_plans").insert({
    organization_id,
    gym_id,
    name,
    price,
    duration_value,
    duration_unit,
    branch_access: "all",
  } as any);

  if (error) return { error: error.message };
  return {};
}

export async function finishOnboarding(organization_id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", { p_organization_id: organization_id });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
