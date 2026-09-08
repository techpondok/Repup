"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CheckInResult = {
  error?: string;
  result_status?: "success" | "denied";
  denial_reason?: string | null;
  member_name?: string;
  plan_name?: string | null;
  valid_until?: string | null;
  branch_name?: string;
};

export async function checkInMember(
  memberId: string,
  branchId: string,
  method: "search" | "member_id" | "qr" | "manual" = "search"
): Promise<CheckInResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("perform_check_in", {
    p_member_id: memberId,
    p_branch_id: branchId,
    p_method: method,
    p_duplicate_window_minutes: 30,
  });

  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/check-in");
  revalidatePath("/dashboard");

  return {
    result_status: row.result_status,
    denial_reason: row.denial_reason,
    member_name: row.member_name,
    plan_name: row.plan_name,
    valid_until: row.valid_until,
    branch_name: row.branch_name,
  };
}

export async function searchMembersForCheckIn(organizationId: string, q: string) {
  const supabase = await createClient();
  if (!q.trim()) return [];
  const { data } = await supabase
    .from("members")
    .select("id, full_name, member_code, phone, photo_url")
    .eq("organization_id", organizationId)
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%`)
    .limit(8);
  return data ?? [];
}
