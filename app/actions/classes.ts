"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authorization";

export type ActionResult = { error?: string };

export async function createClassSession(formData: FormData): Promise<ActionResult> {
  const ctx = await requirePermission("classes.manage");
  if (!ctx.isOrgWide) return { error: "Hanya owner atau admin yang dapat menjadwalkan kelas." };
  const supabase = await createClient();

  const organization_id = ctx.organization.id;
  const gym_id = String(formData.get("gym_id") || "");
  const branch_id = String(formData.get("branch_id") || "");
  const trainer_id = String(formData.get("trainer_id") || "");
  const name = String(formData.get("name") || "").trim();
  const session_date = String(formData.get("session_date") || "");
  const start_time = String(formData.get("start_time") || "");
  const end_time = String(formData.get("end_time") || "");
  const capacity = Number(formData.get("capacity") || 20);
  const price = Number(formData.get("price") || 0);

  if (!name || !session_date || !start_time || !end_time || !branch_id || !trainer_id) {
    return { error: "Nama kelas, coach, tanggal, dan waktu wajib diisi." };
  }
  if (end_time <= start_time) return { error: "Waktu selesai harus setelah waktu mulai." };
  if (capacity < 1) return { error: "Kapasitas harus lebih dari 0." };

  const { data: coachRole } = await supabase.from("trainer_roles").select("trainer_id").eq("trainer_id", trainer_id).eq("role", "COACH").maybeSingle();
  if (!coachRole) return { error: "Staff yang dipilih bukan Coach." };
  const { data: conflicts } = await supabase.from("classes").select("id, start_time, end_time").eq("branch_id", branch_id).eq("trainer_id", trainer_id).eq("session_date", session_date).neq("status", "cancelled");
  if ((conflicts ?? []).some((item: any) => start_time < item.end_time && end_time > item.start_time)) return { error: "COACH SCHEDULE CONFLICT: coach sudah memiliki kelas pada waktu tersebut." };

  const { error } = await supabase.from("classes").insert({
    organization_id,
    gym_id,
    branch_id,
    trainer_id,
    name,
    session_date,
    start_time,
    end_time,
    capacity,
    price,
  } as any);

  if (error) return { error: error.message };
  revalidatePath("/classes");
  return {};
}

export async function cancelClass(id: string) {
  const ctx = await requirePermission("classes.manage");
  if (!ctx.isOrgWide) return { error: "Hanya owner atau admin yang dapat mengubah jadwal kelas." };
  const supabase = await createClient();
  const { error } = await supabase.from("classes").update({ status: "cancelled" } as any).eq("id", id).eq("organization_id", ctx.organization.id);
  if (error) return { error: error.message };
  revalidatePath("/classes");
  return {};
}
