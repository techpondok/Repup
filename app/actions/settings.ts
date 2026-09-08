"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string };

export async function updateGymSettings(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const gym_id = String(formData.get("gym_id") || "");
  const name = String(formData.get("name") || "").trim();
  const contact_phone = String(formData.get("contact_phone") || "").trim() || null;
  const contact_email = String(formData.get("contact_email") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const currency = String(formData.get("currency") || "IDR");
  const timezone = String(formData.get("timezone") || "Asia/Jakarta");

  if (!name || !gym_id) return { error: "Nama gym wajib diisi." };

  const { error } = await supabase
    .from("gyms")
    .update({ name, contact_phone, contact_email, address, currency, timezone } as any)
    .eq("id", gym_id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}

export async function updateOrganizationSettings(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") || "");
  const name = String(formData.get("name") || "").trim();
  const legal_name = String(formData.get("legal_name") || "").trim() || null;
  const billing_email = String(formData.get("billing_email") || "").trim() || null;

  if (!name || !organization_id) return { error: "Nama organisasi wajib diisi." };

  const { error } = await supabase
    .from("organizations")
    .update({ name, legal_name, billing_email } as any)
    .eq("id", organization_id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return {};
}
