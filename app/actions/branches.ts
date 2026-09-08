"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string };

export async function createBranch(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const organization_id = String(formData.get("organization_id") || "");
  const gym_id = String(formData.get("gym_id") || "");
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;

  if (!name || !organization_id || !gym_id) return { error: "Nama cabang wajib diisi." };

  const code = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "GEN";

  const { data: branch, error } = await supabase
    .from("branches")
    .insert({ organization_id, gym_id, name, address, phone, code } as any)
    .select("id")
    .single();

  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("branch_users").insert({
      branch_id: (branch as any).id,
      organization_id,
      user_id: user.id,
    } as any);
  }

  revalidatePath("/branches");
  return {};
}

export async function inviteStaff(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") || "");
  const invited_email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "staff");

  if (!invited_email || !organization_id) return { error: "Email wajib diisi." };

  const { error } = await supabase.from("organization_users").insert({
    organization_id,
    user_id: null,
    invited_email,
    role,
    status: "invited",
  } as any);

  if (error) return { error: error.message };
  revalidatePath("/staff");
  return {};
}
