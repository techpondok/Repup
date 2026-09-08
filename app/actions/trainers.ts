"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string };

export async function createTrainer(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const organization_id = String(formData.get("organization_id") || "");
  const gym_id = String(formData.get("gym_id") || "");
  const branch_id = String(formData.get("branch_id") || "");
  const full_name = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const specialization = String(formData.get("specialization") || "").trim() || null;
  const employment_type = String(formData.get("employment_type") || "freelance");
  const role = String(formData.get("role") || "TRAINER");

  if (!full_name || !organization_id) return { error: "Nama trainer wajib diisi." };

  const { data: trainer, error } = await supabase
    .from("trainers")
    .insert({ organization_id, gym_id, full_name, phone, email, specialization, employment_type } as any)
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (branch_id) {
    await supabase.from("trainer_branches").insert({ trainer_id: (trainer as any).id, branch_id } as any);
  }
  if (role === "COACH" || role === "TRAINER") await supabase.from("trainer_roles").insert({ trainer_id: (trainer as any).id, role } as any);

  revalidatePath("/trainers");
  return {};
}
