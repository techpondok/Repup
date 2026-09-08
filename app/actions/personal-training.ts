"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/authorization";

export type PtActionResult = { error?: string; id?: string };

export async function createPtClient(formData: FormData): Promise<PtActionResult> {
  const ctx = await requirePermission("pt.clients.manage");
  const supabase = await createClient();
  const organization_id = ctx.organization.id;
  const location_id = String(formData.get("location_id") || "");
  const member_id = String(formData.get("member_id") || "");
  const trainer_id = String(formData.get("trainer_id") || "");
  const package_plan_id = String(formData.get("package_plan_id") || "") || null;
  const start_date = String(formData.get("start_date") || "");
  const end_date = String(formData.get("end_date") || "") || null;
  const sessions_total = Number(formData.get("sessions_total") || 0);
  const goal = String(formData.get("goal") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const reason = String(formData.get("reason") || "").trim();

  if (!location_id || !member_id || !trainer_id || !package_plan_id || !start_date || !sessions_total) return { error: "Member, trainer, paket, lokasi, tanggal, dan jumlah sesi wajib diisi." };
  if (sessions_total < 1) return { error: "Jumlah sesi harus lebih dari 0." };
  if (!reason) return { error: "Alasan assignment wajib diisi untuk audit." };

  const [{ data: member }, { data: coach }] = await Promise.all([
    supabase.from("members").select("id").eq("id", member_id).eq("organization_id", organization_id).single(),
    supabase.from("trainers").select("id").eq("id", trainer_id).eq("organization_id", organization_id).single(),
  ]);
  if (!member || !coach) return { error: "Member atau coach tidak ditemukan." };

  const { data, error } = await supabase.from("pt_client_assignments").insert({ organization_id, location_id, member_id, trainer_id, package_plan_id, start_date, end_date, sessions_total, goal, notes } as any).select("id").single();
  if (error) return { error: "PT client gagal ditambahkan." };

  await supabase.from("audit_logs").insert({ organization_id, actor_id: ctx.userId, action: "pt_client.created", entity_type: "coach_client", entity_id: (data as any).id, metadata: { reason } } as any);
  revalidatePath("/pt-clients");
  revalidatePath("/trainers");
  return { id: (data as any).id };
}

function sessionPermission(ctx: Awaited<ReturnType<typeof import("@/lib/tenant").getTenantContext>>, action: "create" | "edit") {
  if (ctx.isOrgWide) return action === "create" ? "pt_sessions.create_all" as const : "pt_sessions.edit_all" as const;
  return action === "create" ? "pt_sessions.create_own" as const : "pt_sessions.edit_own" as const;
}

export async function createPtSession(formData: FormData): Promise<PtActionResult> {
  const ctx = await (await import("@/lib/tenant")).getTenantContext();
  await requirePermission(sessionPermission(ctx, "create"));
  const supabase = await createClient();
  const assignment_id = String(formData.get("assignment_id") || "");
  const session_date = String(formData.get("session_date") || "");
  const start_time = String(formData.get("start_time") || "");
  const duration_minutes = Number(formData.get("duration_minutes") || 60);
  const notes = String(formData.get("notes") || "").trim() || null;
  const location_id = String(formData.get("location_id") || "");
  if (!assignment_id || !session_date || !start_time || !location_id) return { error: "Client, lokasi, tanggal, dan waktu wajib diisi." };
  const { data: assignment } = await supabase.from("pt_client_assignments").select("id, member_id, trainer_id, organization_id, location_id, status").eq("id", assignment_id).eq("organization_id", ctx.organization.id).single();
  if (!assignment || assignment.status !== "active") return { error: "PT client tidak aktif atau tidak ditemukan." };
  const scheduledAt = new Date(`${session_date}T${start_time}:00+07:00`);
  const end = new Date(scheduledAt.getTime() + duration_minutes * 60000);
  if (Number.isNaN(scheduledAt.getTime()) || duration_minutes < 15) return { error: "Jadwal sesi tidak valid." };
  const { data: conflicts } = await supabase.from("pt_sessions").select("id, scheduled_at, duration_minutes, member_id").eq("organization_id", ctx.organization.id).eq("session_date", session_date).neq("status", "cancelled").or(`trainer_id.eq.${assignment.trainer_id},member_id.eq.${assignment.member_id}`);
  if ((conflicts ?? []).some((item: any) => { const start = new Date(item.scheduled_at).getTime(); const finish = start + Number(item.duration_minutes) * 60000; return scheduledAt.getTime() < finish && end.getTime() > start; })) return { error: "Trainer atau member tidak tersedia pada waktu tersebut." };
  const { data: created, error } = await supabase.from("pt_sessions").insert({ organization_id: ctx.organization.id, location_id, pt_client_assignment_id: assignment.id, member_id: assignment.member_id, trainer_id: assignment.trainer_id, session_date, start_time, end_time: end.toISOString().slice(11, 19), scheduled_at: scheduledAt.toISOString(), duration_minutes, notes } as any).select("id").single();
  if (error) return { error: "Sesi PT gagal dijadwalkan." };
  revalidatePath("/pt-clients");
  revalidatePath(`/pt-clients/${assignment.id}`);
  return { id: (created as any).id };
}

export async function updatePtSession(formData: FormData): Promise<PtActionResult> {
  const ctx = await (await import("@/lib/tenant")).getTenantContext();
  await requirePermission(sessionPermission(ctx, "edit"));
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const session_date = String(formData.get("session_date") || "");
  const start_time = String(formData.get("start_time") || "");
  const duration_minutes = Number(formData.get("duration_minutes") || 60);
  const status = String(formData.get("status") || "scheduled");
  const notes = String(formData.get("notes") || "").trim() || null;
  const scheduledAt = new Date(`${session_date}T${start_time}:00+07:00`);
  const end = new Date(scheduledAt.getTime() + duration_minutes * 60000);
  if (!id || Number.isNaN(scheduledAt.getTime()) || duration_minutes < 15) return { error: "Jadwal sesi tidak valid." };
  const { data: session } = await supabase.from("pt_sessions").select("id, trainer_id, member_id, organization_id").eq("id", id).eq("organization_id", ctx.organization.id).single();
  if (!session) return { error: "Sesi tidak ditemukan." };
  const { data: conflicts } = await supabase.from("pt_sessions").select("id, scheduled_at, duration_minutes").eq("organization_id", ctx.organization.id).eq("session_date", session_date).neq("id", id).neq("status", "cancelled").or(`trainer_id.eq.${session.trainer_id},member_id.eq.${session.member_id}`);
  if ((conflicts ?? []).some((item: any) => { const start = new Date(item.scheduled_at).getTime(); const finish = start + Number(item.duration_minutes) * 60000; return scheduledAt.getTime() < finish && end.getTime() > start; })) return { error: "Trainer atau member tidak tersedia pada waktu tersebut." };
  const { error } = await supabase.from("pt_sessions").update({ session_date, start_time, end_time: end.toISOString().slice(11, 19), scheduled_at: scheduledAt.toISOString(), duration_minutes, status, notes } as any).eq("id", id);
  if (error) return { error: "Sesi PT gagal diperbarui." };
  revalidatePath("/pt-clients");
  return {};
}
