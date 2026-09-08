"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authorization";

export type ActionResult = { error?: string; id?: string };

export async function createMember(formData: FormData): Promise<ActionResult> {
  await requirePermission("members.edit");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir." };

  const organization_id = String(formData.get("organization_id") || "");
  const gym_id = String(formData.get("gym_id") || "");
  const branch_id = String(formData.get("branch_id") || "");
  const full_name = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const gender = String(formData.get("gender") || "") || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!full_name || !organization_id || !branch_id) {
    return { error: "Nama dan cabang wajib diisi." };
  }

  const { data: codeData } = await supabase.rpc("next_member_code", { p_organization_id: organization_id });

  const { data, error } = await supabase
    .from("members")
    .insert({
      organization_id,
      gym_id,
      branch_id,
      member_code: codeData || `M-${Date.now()}`,
      full_name,
      phone,
      email,
      gender,
      notes,
      status: "visitor",
      created_by: user.id,
    } as any)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/members");
  return { id: (data as any).id };
}

export async function updateMemberStatus(memberId: string, status: string) {
  await requirePermission("members.edit");
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ status } as any).eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return {};
}

export async function archiveMember(memberId: string) {
  await requirePermission("members.edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ status: "archived", archived_at: new Date().toISOString() } as any)
    .eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath("/members");
  redirect("/members");
}
