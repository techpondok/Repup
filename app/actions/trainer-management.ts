"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import {
  openSession, trainerFormValues, validateTrainerAvailability, isTrainerPhoto,
  type Availability, type ManagedTrainer, type TrainerDetail, type TrainerSession, type TrainerWorkspace,
} from "@/lib/trainer-management";
import { loadStaffPt } from "./pt-bookings";

const ids = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

type Client = Awaited<ReturnType<typeof createClient>>;
type Context = Awaited<ReturnType<typeof getTenantContext>>;
type TrainerRow = {
  id: string; full_name: string; trainer_code: string; phone: string | null; email: string | null; gender: string | null;
  biography: string | null; specializations: string[] | null; specialization: string | null; experience_years: number; certifications: string | null;
  employment_schedule: ManagedTrainer["employment"] | null; employment_type: string; trainer_status: ManagedTrainer["status"] | null;
  is_active: boolean; default_session_rate: number; session_duration: number; photo_url: string | null; availability: Availability | null;
};
type MemberJoin = { full_name: string; photo_url: string | null };
type AssignmentRow = { id: string; member_id: string; status: string; session_duration: number | null; members: MemberJoin | null;
  membership_plans: { id: string; name: string; price: number; duration_unit: string; duration_value: number; visit_limit: number | null; is_active: boolean } | null };
type CountRow = { trainer_id: string; member_id: string };

async function readTrainerRows<T>(getPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>) {
  const rows: T[] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await getPage(offset, offset + pageSize - 1);
    if (error || !Array.isArray(data)) return null;
    rows.push(...data as T[]);
    if (data.length < pageSize) return rows;
  }
}

function activeGym(ctx: Context) { return ctx.branch?.gym_id ?? ctx.gyms[0]?.id; }
function trainerSelf(ctx: Context) { return ["trainer", "coach"].includes(ctx.organization.role); }
function canRead(ctx: Context) { return ctx.isOrgWide || trainerSelf(ctx); }

function roster(supabase: Client, ctx: Context, gym: string) {
  const query = supabase.from("trainers").select("*,trainer_roles!inner(role)")
    .eq("organization_id", ctx.organization.id).eq("gym_id", gym).eq("trainer_roles.role", "TRAINER").is("archived_at", null);
  return ctx.isOrgWide ? query : query.eq("user_id", ctx.userId);
}

function toTrainer(row: TrainerRow, activeMembers = 0, timezone = "Asia/Jakarta"): ManagedTrainer {
  return {
    id: row.id, name: row.full_name, code: row.trainer_code, phone: row.phone, email: row.email, gender: row.gender,
    bio: row.biography ?? "", specializations: row.specializations ?? row.specialization?.split(",").map(value => value.trim()).filter(Boolean) ?? [],
    experience: row.experience_years, certifications: row.certifications ?? "",
    employment: row.employment_schedule ?? (row.employment_type === "employee" ? "full_time" : "freelance"),
    status: row.trainer_status ?? (row.is_active ? "active" : "inactive"), rate: Number(row.default_session_rate), duration: row.session_duration,
    photo: row.photo_url, activeMembers, timezone, availability: row.availability,
  };
}

export async function loadTrainerWorkspace(): Promise<TrainerWorkspace> {
  const ctx = await getTenantContext();
  const base = {
    scopeKey: [ctx.organization.id, activeGym(ctx), ctx.branch?.id, ctx.userId, ctx.demoRole ?? ctx.organization.role].join(":"),
    trainers: [], canManage: false, canEditSessions: false, actorName: ctx.profile.full_name || "Current user", demo: ctx.isDemo,
  };
  if (ctx.isDemo) {
    const allowed = ctx.isOrgWide || ctx.demoRole === "TRAINER";
    return { ...base, canManage: ctx.isOrgWide, canEditSessions: allowed,
      error: allowed ? undefined : "Your demo role cannot access Trainer Management." };
  }
  const gym = activeGym(ctx);
  if (!canRead(ctx)) return { ...base, error: "Your role cannot access Trainer Management." };
  if (!gym) return { ...base, error: "Select a gym to manage trainers." };
  const supabase = await createClient();
  const rows = await readTrainerRows<TrainerRow>((from, to) => roster(supabase, ctx, gym).order("full_name").order("id").range(from, to));
  if (!rows) return { ...base, error: "Could not load trainers." };
  const counts = new Map<string, Set<string>>();
  for (let offset = 0; offset < rows.length; offset += 100) {
    const trainerIds = rows.slice(offset, offset + 100).map(row => row.id);
    const assignments = await readTrainerRows<CountRow>((from, to) => supabase.from("pt_client_assignments").select("trainer_id,member_id")
      .eq("organization_id", ctx.organization.id).eq("status", "active").in("trainer_id", trainerIds).order("id").range(from, to));
    if (!assignments) return { ...base, error: "Could not load trainer member counts." };
    for (const { trainer_id, member_id } of assignments) {
      if (!counts.has(trainer_id)) counts.set(trainer_id, new Set());
      counts.get(trainer_id)!.add(member_id);
    }
  }
  const timezone = ctx.gyms.find(item => item.id === gym)?.timezone;
  return { ...base, trainers: rows.map(row => toTrainer(row, counts.get(row.id)?.size, timezone)), canManage: ctx.isOrgWide && !!ctx.branch, canEditSessions: ctx.isOrgWide || trainerSelf(ctx) };
}

export async function loadTrainerDetail(id: string): Promise<TrainerDetail | { error: string }> {
  const ctx = await getTenantContext();
  const gym = activeGym(ctx);
  if (ctx.isDemo || !canRead(ctx) || !gym || !ids.test(id)) return { error: "Trainer unavailable." };
  const supabase = await createClient();
  const { data: row, error } = await roster(supabase, ctx, gym).eq("id", id).maybeSingle();
  if (error || !row) return { error: "Could not load trainer detail." };
  const [assignments, portal] = await Promise.all([
    readTrainerRows<AssignmentRow>((from, to) => supabase.from("pt_client_assignments").select("id,member_id,status,session_duration,members(full_name,photo_url),membership_plans(id,name,price,duration_unit,duration_value,visit_limit,is_active)")
      .eq("organization_id", ctx.organization.id).eq("trainer_id", id).order("created_at", { ascending: false }).order("id").range(from, to)),
    loadStaffPt(),
  ]);
  if (!assignments || portal.error) return { error: "Could not load trainer schedule and members." };
  const sessions: TrainerSession[] = portal.bookings.filter(booking => booking.trainerId === id && booking.scheduledAt).map(booking => ({
    id: booking.id, assignmentId: booking.assignmentId, memberName: booking.memberName, date: booking.date, start: booking.start,
    end: booking.end, status: booking.status, scheduledAt: booking.scheduledAt!, packageName: booking.packageName, approvalExpiresAt: booking.approvalExpiresAt,
  }));
  const recent = new Map<string, { last: string | null; next: string | null }>();
  const remaining = new Map(portal.assignments.map(assignment => [assignment.id, assignment.available]));
  const now = Date.now();
  for (const session of portal.bookings) {
    if (!session.scheduledAt) continue;
    const summary = recent.get(session.assignmentId) ?? { last: null, next: null };
    if (session.status === "completed" && (!summary.last || session.scheduledAt > summary.last)) summary.last = session.scheduledAt;
    if (openSession(session.status) && Date.parse(session.scheduledAt) >= now && (!summary.next || session.scheduledAt < summary.next)) summary.next = session.scheduledAt;
    recent.set(session.assignmentId, summary);
  }
  const members = assignments.map(assignment => ({
    id: assignment.id, name: assignment.members?.full_name ?? "Member", photo: assignment.members?.photo_url ?? null,
    packageName: assignment.membership_plans?.name ?? null, status: assignment.status,
    lastSession: recent.get(assignment.id)?.last ?? null, nextSession: recent.get(assignment.id)?.next ?? null,
    remainingSessions: remaining.get(assignment.id),
  }));
  const activeMembers = new Set(assignments.filter(assignment => assignment.status === "active").map(assignment => assignment.member_id)).size;
  const packages = new Map<string, NonNullable<TrainerDetail["packages"]>[number]>();
  for (const assignment of assignments) {
    const plan = assignment.membership_plans;
    if (assignment.status !== "active" || !plan || packages.has(plan.id)) continue;
    const value = plan.duration_unit === "visit" ? plan.visit_limit ?? plan.duration_value : plan.duration_value;
    const duration = `${value} ${plan.duration_unit}${value === 1 ? "" : "s"}`;
    packages.set(plan.id, { id: plan.id, name: plan.name, rate: Number(plan.price), duration,
      sessionDuration: assignment.session_duration ?? undefined, availability: plan.is_active ? "Active" : "Catalog inactive" });
  }
  return { trainer: toTrainer(row as unknown as TrainerRow, activeMembers, ctx.gyms.find(item => item.id === gym)?.timezone), sessions, members, packages: [...packages.values()] };
}

export async function saveManagedTrainer(id: string | null, formData: FormData) {
  const ctx = await getTenantContext();
  if (!ctx.isOrgWide || ctx.isDemo || !ctx.branch || (id && !ids.test(id))) return { error: "Trainer management is restricted." };
  const result = trainerFormValues(formData);
  if (!result.values) return { error: result.error };
  if (result.photo && !(await isTrainerPhoto(result.photo))) return { error: "Choose a valid JPG, PNG, or WebP image." };
  const photo = result.photo ? `data:${result.photo.type};base64,${Buffer.from(await result.photo.arrayBuffer()).toString("base64")}` : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_managed_trainer", {
    p_org: ctx.organization.id, p_gym: ctx.branch.gym_id, p_branch: ctx.branch.id, p_id: id, p_profile: { ...result.values, photo },
  });
  if (error || !data) return { error: "Could not save trainer. Check the form and try again." };
  revalidatePath("/trainers");
  return { id: data as string };
}

export async function saveTrainerAvailability(id: string, availability: Availability) {
  const ctx = await getTenantContext();
  const gym = activeGym(ctx);
  if (!ctx.isOrgWide || ctx.isDemo || !gym || !ids.test(id)) return { error: "Trainer management is restricted." };
  const validationError = validateTrainerAvailability(availability);
  if (validationError) return { error: validationError };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_trainer_availability", { p_org: ctx.organization.id, p_gym: gym, p_id: id, p_availability: availability });
  if (error) return { error: "Could not save availability." };
  revalidatePath("/trainers");
  return { conflicts: Number(data) };
}
