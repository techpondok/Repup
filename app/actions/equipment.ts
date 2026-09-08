"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string };

export async function createEquipment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const organization_id = String(formData.get("organization_id") || "");
  const gym_id = String(formData.get("gym_id") || "");
  const branch_id = String(formData.get("branch_id") || "");
  const category_id = String(formData.get("category_id") || "") || null;
  const name = String(formData.get("name") || "").trim();
  const brand = String(formData.get("brand") || "").trim() || null;
  const quantity = Number(formData.get("quantity") || 1);
  const condition = String(formData.get("condition") || "good");

  if (!name || !organization_id || !branch_id) return { error: "Nama peralatan wajib diisi." };

  const { error } = await supabase.from("equipment").insert({
    organization_id,
    gym_id,
    branch_id,
    category_id,
    name,
    brand,
    quantity,
    condition,
    status: "available",
  } as any);

  if (error) return { error: error.message };
  revalidatePath("/equipment");
  return {};
}

export async function updateEquipmentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipment").update({ status } as any).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/equipment");
  return {};
}
