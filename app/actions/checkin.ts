"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkIn, type AttendanceDirection, type CheckInSource, type CheckInServiceResult } from "@/lib/checkin/service";

export type CheckInResult = CheckInServiceResult;

export async function checkInIdentifier(identifier: string, branchId: string, source: CheckInSource = "manual", deviceId?: string, direction: AttendanceDirection = "IN"): Promise<CheckInResult> {
  const result = await checkIn({ identifier, source, deviceId, branchId, direction });
  if (!result.error) {
    revalidatePath("/check-in");
    revalidatePath("/dashboard");
  }
  return result;
}

export async function checkOutIdentifier(identifier: string, branchId: string, source: CheckInSource = "staff", deviceId?: string): Promise<CheckInResult> {
  return checkInIdentifier(identifier, branchId, source, deviceId, "OUT");
}

export async function checkInMember(memberId: string, branchId: string, method: "search" | "member_id" | "qr" | "manual" = "search"): Promise<CheckInResult> {
  return checkInIdentifier(memberId, branchId, method === "qr" ? "camera_qr" : "manual");
}

export async function searchMembersForCheckIn(organizationId: string, q: string) {
  const supabase = await createClient();
  if (!q.trim()) return [];
  const { data } = await supabase.from("members").select("id, full_name, member_code, phone, photo_url").eq("organization_id", organizationId).or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%`).limit(8);
  return data ?? [];
}

export async function getRecentCheckIns(branchId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("check_ins").select("id, occurred_at, method, source, device_id, status, denial_reason, members(full_name, member_code), memberships(membership_plans(name))").eq("branch_id", branchId).order("occurred_at", { ascending: false }).limit(12);
  return data ?? [];
}

export async function getActiveVisits(branchId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("check_ins").select("id, member_id, occurred_at, source, device_id, members(full_name, member_code), memberships(membership_plans(name))").eq("branch_id", branchId).eq("status", "success").eq("attendance_status", "active").order("occurred_at", { ascending: true });
  return data ?? [];
}

export async function getRecentAttendance(branchId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("check_ins").select("id, occurred_at, check_out_at, duration_seconds, attendance_status, method, source, device_id, status, denial_reason, members(full_name, member_code), memberships(membership_plans(name))").eq("branch_id", branchId).order("occurred_at", { ascending: false }).limit(20);
  return data ?? [];
}
