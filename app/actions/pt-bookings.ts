"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { isCalendarDate } from "@/lib/calendar";
import { defaultPtSettings, type PtBookingOperation, type PtPortal, type PtSettings } from "@/lib/pt-bookings";

const ids = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const empty = (): PtPortal => ({ assignments: [], bookings: [], requests: [], trainers: [] });
const validId = (value: unknown): value is string => typeof value === "string" && ids.test(value);
type MutationResult = { id?: string; error?: string };

export async function loadMemberPt(): Promise<PtPortal | null> {
  if ((await cookies()).get("ru_demo")?.value === "1") return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("pt_workspace", { p_org: null, p_gym: null, p_member: true });
  return error ? { ...empty(), error: "Could not load your personal training. Try again." } : data as PtPortal;
}
export async function loadStaffPt(): Promise<PtPortal> {
  const ctx = await getTenantContext();
  if (ctx.isDemo) return empty();
  const gym = ctx.branch?.gym_id ?? ctx.gyms[0]?.id;
  if (!gym) return { ...empty(), error: "Select a gym to view PT bookings." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pt_workspace", { p_org: ctx.organization.id, p_gym: gym, p_member: false });
  return error ? { ...empty(), error: "Could not load PT bookings. Try again." } : data as PtPortal;
}

export async function loadPtSlots(assignmentId: string, date: string, sessionId?: string): Promise<{ slots: string[]; error?: string }> {
  if (!validId(assignmentId) || (sessionId && !validId(sessionId)) || !isCalendarDate(date)) return { slots: [], error: "Choose a valid package and date." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pt_available_slots", { p_assignment: assignmentId, p_date: date, p_session: sessionId ?? null });
  return error ? { slots: [], error: error.code === "P0001" ? error.message : "Could not load available sessions." } : { slots: data as string[] };
}

export async function loadPtReplacementSlots(assignmentId: string, trainerId: string, date: string, sessionId?: string): Promise<{ slots: string[]; error?: string }> {
  if (!validId(assignmentId) || !validId(trainerId) || (sessionId && !validId(sessionId)) || !isCalendarDate(date)) {
    return { slots: [], error: "Choose a valid trainer and date." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pt_available_slots", { p_assignment: assignmentId, p_date: date, p_session: sessionId ?? null, p_candidate: trainerId });
  return error ? { slots: [], error: error.code === "P0001" ? error.message : "Could not load trainer availability." } : { slots: data as string[] };
}

export async function loadPtSlotDates(assignmentId: string, dates: string[], sessionId?: string): Promise<{ dates: string[]; error?: string }> {
  if (!Array.isArray(dates) || dates.length > 7) return { dates: [], error: "Choose up to seven dates." };
  const calendar = [...new Set(dates)];
  const results = await Promise.all(calendar.map(date => loadPtSlots(assignmentId, date, sessionId)));
  if (results.every(result => result.error)) return { dates: [], error: results[0]?.error };
  return { dates: calendar.filter((_, index) => results[index].slots.length > 0) };
}

async function mutateBooking(rpc: string, args: Record<string, string | null>): Promise<MutationResult> {
  if ((await cookies()).get("ru_demo")?.value === "1") return { error: "Use a live account for this action." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc, args);
  if (error || !data) {
    if (error && error.code !== "P0001") console.error("[PT][BOOKING]", rpc, error.code);
    return { error: error?.code === "P0001" ? error.message : "Could not update personal training. Try again." };
  }
  revalidatePath("/pt-clients");
  revalidatePath("/trainers");
  revalidatePath("/member/pt", "layout");
  return { id: data as string };
}

export async function createPtBooking(assignmentId: string, date: string, start: string): Promise<MutationResult> {
  if (!validId(assignmentId) || !isCalendarDate(date) || !time.test(start)) return { error: "Choose a valid date and start time." };
  return mutateBooking("pt_create_booking", { p_assignment: assignmentId, p_date: date, p_time: start });
}
export async function changePtBooking(id: string, operation: PtBookingOperation, date?: string, start?: string, reason?: string): Promise<MutationResult> {
  if (!validId(id) || (operation === "reschedule" && (!date || !isCalendarDate(date) || !start || !time.test(start)))) {
    return { error: "Choose a valid booking and schedule." };
  }
  return mutateBooking("pt_change_booking", { p_id: id, p_operation: operation, p_date: date ?? null, p_time: start ?? null, p_reason: reason ?? null });
}
export async function requestPtTrainerChange(assignmentId: string, reason: string, preferredTrainer?: string | null, notes?: string) {
  if (!validId(assignmentId) || (preferredTrainer && !validId(preferredTrainer))) return { error: "Choose a valid package and trainer." };
  return mutateBooking("pt_request_trainer_change", { p_assignment: assignmentId, p_reason: reason, p_preferred: preferredTrainer || null, p_notes: notes ?? null });
}
export async function reviewPtTrainerChange(id: string, decision: "approved" | "rejected", trainerId?: string | null, reason?: string) {
  if (!validId(id) || (trainerId && !validId(trainerId))) return { error: "Choose a valid request and trainer." };
  return mutateBooking("pt_review_trainer_change", { p_request: id, p_decision: decision, p_trainer: trainerId || null, p_reason: reason ?? null });
}
export async function replacePtTrainer(assignmentId: string, sessionId: string | null, trainerId: string, reason: string) {
  if (!validId(assignmentId) || (sessionId && !validId(sessionId)) || !validId(trainerId)) return { error: "Choose a valid package, session, and trainer." };
  return mutateBooking("pt_replace_trainer", { p_assignment: assignmentId, p_session: sessionId, p_trainer: trainerId, p_reason: reason });
}
export async function loadPtSettings(): Promise<PtSettings | null> {
  const ctx = await getTenantContext();
  const gym = ctx.branch?.gym_id ?? ctx.gyms[0]?.id;
  if (ctx.isDemo || !ctx.isOrgWide || !gym) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("pt_read_settings", { p_org: ctx.organization.id, p_gym: gym });
  return data ? { ...defaultPtSettings, ...data } : null;
}
export async function savePtSettings(settings: PtSettings): Promise<{ error?: string }> {
  const ctx = await getTenantContext();
  const gym = ctx.branch?.gym_id ?? ctx.gyms[0]?.id;
  if (ctx.isDemo || !ctx.isOrgWide || !gym) return { error: "Only gym administrators can change PT settings." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pt_write_settings", { p_org: ctx.organization.id, p_gym: gym, p_settings: settings });
  if (error || !data) return { error: error?.code === "P0001" ? error.message : "Could not save PT settings." };
  revalidatePath("/settings");
  return {};
}
