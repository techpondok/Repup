"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";
import { checkIn, type AttendanceDirection, type CheckInSource, type CheckInServiceResult } from "@/lib/checkin/service";

export type CheckInResult = CheckInServiceResult;

async function attendanceClient(branchId: string) {
  const ctx = await requirePermission("checkin.manage");
  if (ctx.isDemo || !ctx.branches.some(branch => branch.id === branchId)) throw new Error("Cabang tidak tersedia.");
  return createClient();
}

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
  const query = q.trim().slice(0, 100).replace(/[^\p{L}\p{N}\s+@'-]/gu, "");
  if (!query) return [];
  const ctx = await requirePermission("checkin.manage");
  if (ctx.isDemo || ctx.organization.id !== organizationId || !ctx.branch) throw new Error("Cabang tidak tersedia.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("members").select("id, full_name, member_code, phone").eq("organization_id", ctx.organization.id).eq("branch_id", ctx.branch.id).or(`full_name.ilike.%${query}%,phone.ilike.%${query}%,member_code.ilike.%${query}%`).limit(8);
  if (error) throw new Error("Pencarian member gagal.");
  return data ?? [];
}

export async function getRecentCheckIns(branchId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("check_ins").select("id, occurred_at, method, source, device_id, status, denial_reason, members(full_name, member_code), memberships(membership_plans(name))").eq("branch_id", branchId).order("occurred_at", { ascending: false }).limit(12);
  return data ?? [];
}

export async function getActiveVisits(branchId: string) {
  const supabase = await attendanceClient(branchId);
  const { data, error } = await supabase.from("check_ins").select("id, member_id, occurred_at, source, device_id, members(full_name, member_code), memberships(membership_plans(name))").eq("branch_id", branchId).eq("status", "success").eq("attendance_status", "active").order("occurred_at", { ascending: true });
  if (error) throw new Error("Kunjungan aktif gagal dimuat.");
  return data ?? [];
}

export async function getRecentAttendance(branchId: string) {
  const supabase = await attendanceClient(branchId);
  const { data, error } = await supabase.from("check_ins").select("id, occurred_at, check_out_at, duration_seconds, attendance_status, method, source, device_id, status, denial_reason, members(full_name, member_code), memberships(membership_plans(name))").eq("branch_id", branchId).order("occurred_at", { ascending: false }).limit(20);
  if (error) throw new Error("Riwayat gagal dimuat.");
  return data ?? [];
}
