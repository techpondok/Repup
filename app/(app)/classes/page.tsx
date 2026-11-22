import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { DemoClasses } from "@/components/classes/demo-classes";
import { hasDemoPermission } from "@/lib/demo/roles";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Stat } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { NewClassForm } from "@/components/classes/new-class-form";
import { formatDate } from "@/lib/format";
import { CreateFormModal } from "@/components/ui/create-form-modal";

const statusTone: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = { scheduled: "info", ongoing: "success", completed: "neutral", cancelled: "danger" };
const statusLabel: Record<string, string> = { scheduled: "Terjadwal", ongoing: "Berlangsung", completed: "Selesai", cancelled: "Dibatalkan" };

function Tabs({ view }: { view: string }) { return <div className="mb-4 flex gap-1 border-b border-line"><Link href="/classes" className={`px-3 py-2 text-sm ${view === "classes" ? "border-b-2 border-primary font-medium text-primary" : "text-ink-muted"}`}>Classes</Link><Link href="/classes?view=calendar" className={`px-3 py-2 text-sm ${view === "calendar" ? "border-b-2 border-primary font-medium text-primary" : "text-ink-muted"}`}>Calendar</Link><Link href="/classes?view=bookings" className={`px-3 py-2 text-sm ${view === "bookings" ? "border-b-2 border-primary font-medium text-primary" : "text-ink-muted"}`}>Bookings</Link></div>; }

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await getTenantContext();
  const view = (await searchParams).view === "calendar" ? "calendar" : (await searchParams).view === "bookings" ? "bookings" : "classes";
  if (ctx.isDemo) return <DemoClasses view={view} canManage={hasDemoPermission(ctx.demoRole, "classes.manage")}
    canView={hasDemoPermission(ctx.demoRole, "classes.view")} branchIds={ctx.branches.map(branch => branch.id)} />;
  if (!ctx.branch) return <EmptyState title="Belum ada cabang" />;
  const supabase = await createClient();
  const { data: coachRoles } = await supabase.from("trainer_roles").select("trainer_id").eq("role", "COACH");
  const coachIds = (coachRoles ?? []).map((row: any) => row.trainer_id);
  let currentCoachId = "";
  if (!ctx.isOrgWide) { const { data: current } = await supabase.from("trainers").select("id").eq("organization_id", ctx.organization.id).eq("user_id", ctx.userId).maybeSingle(); currentCoachId = current?.id ?? ""; }
  let classesQuery = supabase.from("classes").select("*, trainers(full_name)").eq("branch_id", ctx.branch.id).order("session_date", { ascending: true });
  if (!ctx.isOrgWide && currentCoachId && coachIds.includes(currentCoachId)) classesQuery = classesQuery.eq("trainer_id", currentCoachId);
  const [{ data: classes }, { data: trainers }] = await Promise.all([classesQuery, coachIds.length ? supabase.from("trainers").select("*").eq("organization_id", ctx.organization.id).eq("is_active", true).in("id", coachIds) : Promise.resolve({ data: [] as any[] })]);
  const canManage = ctx.isOrgWide;
  const actions = canManage ? <CreateFormModal title="Jadwalkan Kelas" description="Buat jadwal kelas group baru." size="large" label="+ Schedule Class" form={<NewClassForm organizationId={ctx.organization.id} gymId={ctx.branch.gym_id} branchId={ctx.branch.id} trainers={trainers ?? []} />} /> : undefined;
  return <div><PageHeader title="Kelas" description={`Group class di ${ctx.branch.name}. Coach ditentukan per sesi.`} actions={actions} /><Card statGroup className="mb-4 grid grid-cols-2 sm:grid-cols-4"><Stat label={ctx.isOrgWide ? "Classes Today" : "My Classes Today"} value={String((classes ?? []).length)} /><Stat label="Upcoming Classes" value={String((classes ?? []).filter((item: any) => item.status === "scheduled").length)} /><Stat label="Coaches Active" value={String((trainers ?? []).length)} /><Stat label="Participants" value="-" /></Card><Tabs view={view} />{view === "calendar" ? <ScheduleCalendar title="Class calendar" events={(classes ?? []).map((c: any)=>({id:c.id,title:c.name,date:c.session_date,time:`${c.start_time?.slice(0,5) ?? ""} - ${c.end_time?.slice(0,5) ?? ""}`,description:`Coach ${c.trainers?.full_name ?? "-"} | ${c.capacity} capacity`,status:statusLabel[c.status] ?? c.status}))}/> : view === "bookings" ? <Card><EmptyState title="Pilih sesi kelas" description="Kalender peserta akan terhubung ke booking dan attendance sesi." /></Card> : <Card>{!classes?.length ? <EmptyState title="Belum ada kelas terjadwal" /> : <div className="overflow-x-auto"><DataTable className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-4 py-3">Class</th><th className="px-4 py-3">Coach</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{classes.map((c: any) => <tr key={c.id} className="border-b border-line last:border-0"><td className="px-4 py-3 font-medium text-ink">{c.name}</td><td className="px-4 py-3 text-ink-muted">{c.trainers?.full_name ?? "-"}</td><td className="px-4 py-3 text-ink-muted">{formatDate(c.session_date)} · {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}</td><td className="px-4 py-3">{c.capacity}</td><td className="px-4 py-3"><Badge tone={statusTone[c.status] ?? "neutral"}>{statusLabel[c.status] ?? c.status}</Badge></td></tr>)}</tbody></DataTable></div>}</Card>}</div>;
}
