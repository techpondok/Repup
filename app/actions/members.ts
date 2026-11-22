"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/authorization";
import { randomInt } from "node:crypto";

export type ActionResult = { error?: string; id?: string; warning?: string; code?: string; expiresAt?: string };

const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function pairingCode() {
  return Array.from({ length: 6 }, () => PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]).join("");
}

export async function createMember(formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("members.edit");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir." };

  const organization_id = ctx.organization.id;
  const branch_id = String(formData.get("branch_id") || "");
  const branch = ctx.branches.find((item) => item.id === branch_id);
  const full_name = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const gender = String(formData.get("gender") || "") || null;
  const birth_date = String(formData.get("birth_date") || "") || null;
  const address = String(formData.get("address") || "").trim() || null;
  const emergency_contact = String(formData.get("emergency_contact") || "").trim() || null;
  const member_code = String(formData.get("member_code") || "").trim() || null;
  const membership_plan_id = String(formData.get("membership_plan_id") || "") || null;
  const start_date = String(formData.get("start_date") || "") || new Date().toISOString().slice(0, 10);
  const end_date = String(formData.get("end_date") || "") || null;
  const payment_status = String(formData.get("payment_status") || "unpaid");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!full_name || !phone || !branch) {
    return { error: "Nama, telepon, dan cabang wajib diisi." };
  }

  const duplicateChecks = await Promise.all([
    phone ? supabase.from("members").select("id, full_name, member_code").eq("organization_id", organization_id).eq("phone", phone).neq("status", "archived").limit(1) : Promise.resolve({ data: [] as any[] }),
    email ? supabase.from("members").select("id, full_name, member_code").eq("organization_id", organization_id).ilike("email", email).neq("status", "archived").limit(1) : Promise.resolve({ data: [] as any[] }),
    member_code ? supabase.from("members").select("id").eq("organization_id", organization_id).eq("member_code", member_code).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const duplicate = duplicateChecks.flatMap((result: any) => Array.isArray(result.data) ? result.data : result.data ? [result.data] : [])[0];
  if (member_code && duplicateChecks[2].data) return { error: "Member ID sudah digunakan di organisasi ini." };

  const { data: plan } = membership_plan_id
    ? await supabase.from("membership_plans").select("id, duration_value, duration_unit").eq("id", membership_plan_id).eq("organization_id", organization_id).single()
    : { data: null };
  if (membership_plan_id && !plan) return { error: "Paket membership tidak ditemukan." };
  const { data: codeData } = member_code ? { data: member_code } : await supabase.rpc("next_member_code", { p_organization_id: organization_id });

  const { data, error } = await supabase
    .from("members")
    .insert({
      organization_id,
      gym_id: branch.gym_id,
      branch_id,
      member_code: codeData || `M-${Date.now()}`,
      full_name,
      phone,
      email,
      gender,
      birth_date,
      address,
      emergency_contact,
      notes,
      status: membership_plan_id ? "active" : "visitor",
      created_by: user.id,
    } as any)
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (membership_plan_id) {
    if (!plan) return { error: "Paket membership tidak ditemukan." };
    const calculatedEnd = end_date || (() => {
      const date = new Date(`${start_date}T00:00:00Z`);
      if (plan.duration_unit === "day") date.setUTCDate(date.getUTCDate() + plan.duration_value);
      if (plan.duration_unit === "month") date.setUTCMonth(date.getUTCMonth() + plan.duration_value);
      if (plan.duration_unit === "year") date.setUTCFullYear(date.getUTCFullYear() + plan.duration_value);
      return plan.duration_unit === "visit" ? null : date.toISOString().slice(0, 10);
    })();
    const membershipResult = await supabase.from("memberships").insert({
      organization_id, gym_id: branch.gym_id, branch_id, member_id: (data as any).id,
      membership_plan_id, start_date, end_date: calculatedEnd, status: "active", payment_status,
      created_by: user.id,
    } as any);
    if (membershipResult.error) return { error: membershipResult.error.message };
  }

  revalidatePath("/members");
  return { id: (data as any).id, warning: duplicate ? "Terdapat member dengan data serupa. Periksa sebelum menghubungkan akun." : undefined };
}

export async function generatePairingCode(memberId: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.edit");
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("id, branch_id, gym_id, repup_account_id").eq("id", memberId).eq("organization_id", ctx.organization.id).single();
  if (!member) return { error: "Member tidak ditemukan." };
  if ((member as any).repup_account_id) return { error: "Member sudah terhubung ke akun RepUp." };
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await (supabase as any).from("member_pairing_codes").update({ used_at: new Date().toISOString() }).eq("member_id", memberId).is("used_at", null);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = pairingCode();
    const { error } = await (supabase as any).from("member_pairing_codes").insert({
      organization_id: ctx.organization.id, gym_id: (member as any).gym_id, branch_id: (member as any).branch_id,
      member_id: memberId, code, expires_at: expiresAt, created_by: ctx.userId,
    });
    if (!error) {
      revalidatePath("/members");
      revalidatePath(`/members/${memberId}`);
      return { code, expiresAt };
    }
  }
  return { error: "Pairing code gagal dibuat. Coba lagi." };
}

export async function matchMemberToAccount(memberId: string, userId: string, requestId?: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.edit");
  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("id, branch_id, repup_account_id").eq("id", memberId).eq("organization_id", ctx.organization.id).single();
  if (!member) return { error: "Member tidak ditemukan." };
  if ((member as any).repup_account_id) return { error: "Member sudah terhubung ke akun RepUp." };
  const { data: existing } = await supabase.from("members").select("id").eq("organization_id", ctx.organization.id).eq("repup_account_id", userId).maybeSingle();
  if (existing) return { error: "Akun RepUp ini sudah terhubung ke member lain di gym ini." };
  const { error } = await supabase.from("members").update({ repup_account_id: userId } as any).eq("id", memberId);
  if (error) return { error: error.message };
  if (requestId) await (supabase as any).from("member_join_requests").update({ status: "approved", matched_member_id: memberId, reviewed_at: new Date().toISOString(), reviewed_by: ctx.userId }).eq("id", requestId);
  revalidatePath("/members");
  revalidatePath("/members/requests");
  revalidatePath(`/members/${memberId}`);
  return { id: memberId };
}

export async function reviewJoinRequest(requestId: string, decision: "approved" | "rejected", memberId?: string): Promise<ActionResult> {
  const ctx = await requirePermission("members.edit");
  const supabase = await createClient();
  const { data: request } = await (supabase as any).from("member_join_requests").select("id, branch_id, user_id, matched_member_id").eq("id", requestId).eq("organization_id", ctx.organization.id).single();
  if (!request) return { error: "Permintaan join tidak ditemukan." };
  if (decision === "approved") {
    if (!memberId) return { error: "Pilih member existing untuk menghubungkan akun." };
    return matchMemberToAccount(memberId, request.user_id, requestId);
  }
  const { error } = await (supabase as any).from("member_join_requests").update({ status: decision, reviewed_at: new Date().toISOString(), reviewed_by: ctx.userId }).eq("id", requestId);
  if (error) return { error: error.message };
  revalidatePath("/members/requests");
  revalidatePath("/members");
  return {};
}

export async function updateMemberStatus(memberId: string, status: string) {
  const ctx = await requirePermission("members.edit");
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ status } as any).eq("id", memberId).eq("organization_id", ctx.organization.id);
  if (error) return { error: error.message };
  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  return {};
}

export async function archiveMember(memberId: string) {
  const ctx = await requirePermission("members.edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ status: "archived", archived_at: new Date().toISOString() } as any)
    .eq("id", memberId).eq("organization_id", ctx.organization.id);
  if (error) return { error: error.message };
  revalidatePath("/members");
  redirect("/members");
}
