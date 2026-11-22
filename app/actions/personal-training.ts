"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authorization";
import { isCalendarDate } from "@/lib/calendar";
import { changePtBooking, createPtBooking } from "./pt-bookings";

export type PtActionResult = { error?: string; id?: string };

export async function createPtClient(formData: FormData): Promise<PtActionResult> {
  const ctx = await requirePermission("pt.clients.manage");
  const supabase = await createClient();
  const organization_id = ctx.organization.id;
  const location_id = String(formData.get("location_id") || "");
  const branch = ctx.branches.find(item => item.id === location_id);
  const member_id = String(formData.get("member_id") || "");
  const trainer_id = String(formData.get("trainer_id") || "");
  const package_plan_id = String(formData.get("package_plan_id") || "") || null;
  const start_date = String(formData.get("start_date") || "");
  const end_date = String(formData.get("end_date") || "") || null;
  const requestedSessions = Number(formData.get("sessions_total") || 0);
  const session_duration = Number(formData.get("session_duration") || 0) || null;
  const goal = String(formData.get("goal") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const reason = String(formData.get("reason") || "").trim();

  if (!ctx.isOrgWide || ctx.isDemo || !branch || !member_id || !trainer_id || !package_plan_id || !isCalendarDate(start_date) ||
    (end_date && (!isCalendarDate(end_date) || end_date < start_date)) || (session_duration && ![30, 45, 60, 90].includes(session_duration))) {
    return { error: "Periksa member, trainer, paket, lokasi, durasi, dan tanggal." };
  }
  if (!reason) return { error: "Alasan assignment wajib diisi untuk audit." };

  const [{ data: member }, { data: coach }, { data: plan }] = await Promise.all([
    supabase.from("members").select("id").eq("id", member_id).eq("organization_id", organization_id).eq("gym_id", branch.gym_id).neq("status", "archived").single(),
    supabase.from("trainers").select("id").eq("id", trainer_id).eq("organization_id", organization_id).eq("gym_id", branch.gym_id).eq("is_active", true).single(),
    supabase.from("membership_plans").select("id,visit_limit,pt_session_duration").eq("id", package_plan_id)
      .eq("organization_id", organization_id).eq("gym_id", branch.gym_id).eq("is_active", true).single(),
  ]);
  if (!member || !coach || !plan) return { error: "Member, trainer, atau paket tidak tersedia di gym ini." };
  const sessions_total = plan.visit_limit ?? requestedSessions;
  if (!Number.isInteger(sessions_total) || sessions_total < 1 || sessions_total > 1000) return { error: "Masukkan jumlah sesi antara 1 dan 1000." };

  const { data, error } = await supabase.from("pt_client_assignments").insert({ organization_id, location_id, member_id, trainer_id, package_plan_id,
    start_date, end_date, sessions_total, session_duration: plan.pt_session_duration ?? session_duration, goal, notes, created_by: ctx.userId }).select("id").single();
  if (error) return { error: "PT client gagal ditambahkan." };

  await supabase.from("audit_logs").insert({ organization_id, actor_id: ctx.userId, action: "pt_client.created", entity_type: "coach_client", entity_id: data.id, metadata: { reason } });
  revalidatePath("/pt-clients");
  revalidatePath("/trainers");
  return { id: data.id };
}


export async function createPtSession(formData: FormData): Promise<PtActionResult> {
  const assignmentId = String(formData.get("assignment_id") || "");
  const date = String(formData.get("session_date") || "");
  const start = String(formData.get("start_time") || "");
  return createPtBooking(assignmentId, date, start);
}

export async function updatePtSession(formData: FormData): Promise<PtActionResult> {
  const id = String(formData.get("id") || "");
  const date = String(formData.get("session_date") || "");
  const start = String(formData.get("start_time") || "");
  const reason = String(formData.get("reason") || formData.get("notes") || "").trim();
  const operation = String(formData.get("operation") || "reschedule");
  switch (operation) {
    case "cancel": case "complete": case "no_show": case "approve": case "reject":
      return changePtBooking(id, operation, undefined, undefined, reason);
    case "reschedule": return changePtBooking(id, "reschedule", date, start, reason);
    default: return { error: "Choose a valid booking action." };
  }
}
