import { DemoBranchPT } from "@/components/personal-training/demo-branch-pt";
import { hasDemoPermission } from "@/lib/demo/roles";
import { DemoMemberPT } from "@/components/members/demo-pt";
import { memberDemoScope } from "@/components/members/demo-scope";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { AddPtClientModal } from "@/components/personal-training/add-pt-client-modal";
import { SchedulePtModal } from "@/components/personal-training/schedule-pt-modal";
import { PtCalendar } from "@/components/personal-training/pt-calendar";
import { PtBookingManagement } from "@/components/personal-training/pt-booking-management";
import { loadStaffPt } from "@/app/actions/pt-bookings";
import { formatDate } from "@/lib/format";


const ptTabs = [{ view: "clients", label: "Clients", href: "/pt-clients" }, { view: "calendar", label: "Calendar", href: "/pt-clients?view=calendar" }, { view: "bookings", label: "PT Bookings", href: "/pt-clients?view=bookings" }];
function ModuleTabs({ view }: { view: string }) {
  return <nav aria-label="Personal Training workspace" className="mb-4 flex flex-wrap gap-1 border-b border-line">
    {ptTabs.map(tab => <Link key={tab.view} href={tab.href} aria-current={view === tab.view ? "page" : undefined} className={`px-3 py-2 text-sm ${view === tab.view ? "border-b-2 border-primary font-medium text-primary" : "text-ink-muted hover:text-ink"}`}>{tab.label}</Link>)}
  </nav>;
}


export default async function PtClientsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; member?: string }> }) {
  const ctx = await getTenantContext(); const params = await searchParams; const view = params.view === "calendar" || params.view === "bookings" ? params.view : "clients";
  if (ctx.isDemo && !hasDemoPermission(ctx.demoRole, "pt.clients.view")) return <EmptyState title="PT clients are unavailable for this role." />;
  if (ctx.isDemo && params.member && view !== "clients") return <DemoMemberPT id={params.member} view={view} {...memberDemoScope(ctx)} />;
  if (ctx.isDemo) return <><PageHeader title="PT Clients" description="Demo PT clients and sessions by branch." /><ModuleTabs view={view} /><DemoBranchPT view={view} /></>;
  if (view === "bookings") {
    const empty = { assignments: [], bookings: [], requests: [], trainers: [] };
    const data = ctx.isDemo ? empty : await loadStaffPt().catch(() => ({ ...empty, error: "Could not load PT bookings." }));
    return <div>
      <PageHeader title="PT Bookings" description="Manage Personal Training bookings, approvals, and trainer changes." />
      <ModuleTabs view={view} />
      <PtBookingManagement key={`${ctx.organization.id}:${ctx.branch?.id ?? ""}:${ctx.userId}`} initialData={data} demo={ctx.isDemo} />
    </div>;
  }
  const supabase = await createClient();
  const { data: trainerRoles } = await supabase.from("trainer_roles").select("trainer_id").eq("role", "TRAINER");
  const trainerIds = (trainerRoles ?? []).map((row: any) => row.trainer_id);
  let currentTrainerId = "";
  let clientQuery = supabase.from("pt_client_assignments").select("*, members(full_name, member_code), trainers(full_name), branches(name), membership_plans(name)").eq("organization_id", ctx.organization.id).order("created_at", { ascending: false });
  if (!ctx.isOrgWide) { const { data: currentTrainer } = await supabase.from("trainers").select("id").eq("organization_id", ctx.organization.id).eq("user_id", ctx.userId).maybeSingle(); if (currentTrainer) { currentTrainerId = currentTrainer.id; clientQuery = clientQuery.eq("trainer_id", currentTrainer.id); } }
  if (ctx.branch) clientQuery = clientQuery.eq("location_id", ctx.branch.id);
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? new Date(`${params.date}T00:00:00`) : new Date();
  const monday = new Date(date); monday.setDate(date.getDate() - ((date.getDay() + 6) % 7)); const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);
  const [{ data: clients }, { data: members }, { data: trainers }, { data: plans }, { data: sessions }, bookingWorkspace] = await Promise.all([
    clientQuery,
    supabase.from("members").select("id, full_name, member_code").eq("organization_id", ctx.organization.id).eq("status", "active").order("full_name").limit(200),
    trainerIds.length ? supabase.from("trainers").select("id, full_name").eq("organization_id", ctx.organization.id).eq("is_active", true).in("id", trainerIds).order("full_name") : Promise.resolve({ data: [] as any[] }),
    supabase.from("membership_plans").select("id, name, price, visit_limit").eq("organization_id", ctx.organization.id).eq("is_active", true).order("name"),
    supabase.from("pt_sessions").select("*, members(full_name), trainers:trainers!pt_sessions_coach_id_fkey(full_name)").eq("organization_id", ctx.organization.id).gte("session_date", monday.toISOString().slice(0, 10)).lt("session_date", nextMonday.toISOString().slice(0, 10)).order("session_date").order("start_time").limit(100),
    view === "clients" ? loadStaffPt() : null,
  ]);
  const quotas = new Map(bookingWorkspace?.assignments.map(item => [item.id, item]));
  const locationId = ctx.branch?.id ?? ctx.branches[0]?.id ?? "";
  const assignmentOptions = (clients ?? []).map((client: any) => ({ id: client.id, member: client.members?.full_name ?? "Member", trainer: client.trainers?.full_name ?? "Trainer", locationId: client.location_id, location: client.branches?.name ?? "Lokasi" }));
  const canSchedule = ctx.isOrgWide || trainerIds.includes(currentTrainerId);
  const actions = <div className="flex gap-2">{canSchedule && locationId && <SchedulePtModal assignments={assignmentOptions} locationId={locationId} />}{ctx.isOrgWide && locationId && <AddPtClientModal organizationId={ctx.organization.id} locationId={locationId} members={(members ?? []).map((m: any) => ({ id: m.id, name: `${m.full_name} · ${m.member_code}` }))} coaches={(trainers ?? []).map((t: any) => ({ id: t.id, name: t.full_name }))} plans={plans ?? []} />}</div>;
  return <div><PageHeader title="PT Clients" description="Trainer workspace untuk client, paket, dan sesi Personal Training." actions={actions} /><ModuleTabs view={view} />{view === "calendar" ? <PtCalendar sessions={sessions ?? []} weekStart={monday} /> : <Card>{!clients?.length ? <EmptyState title="Belum ada PT client" description="Assign member existing ke trainer untuk mulai Personal Training." /> : <div className="overflow-x-auto"><DataTable className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-4 py-3">Member</th><th className="px-4 py-3">Trainer</th><th className="px-4 py-3">Package</th><th className="px-4 py-3">Sessions</th><th className="px-4 py-3">Next Session</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{clients.map((client: any) => <tr key={client.id} className="border-b border-line last:border-0"><td className="px-4 py-3"><Link href={`/pt-clients/${client.id}`} className="font-medium text-ink hover:text-primary">{client.members?.full_name}</Link><p className="text-xs text-ink-faint">{client.members?.member_code}</p></td><td className="px-4 py-3 text-ink-muted">{client.trainers?.full_name}</td><td className="px-4 py-3 text-ink-muted">{client.membership_plans?.name ?? "PT Package"}</td><td className="px-4 py-3">{quotas.get(client.id)?.completed ?? client.sessions_used} / {client.sessions_total} <span className="text-xs text-ink-faint">({bookingWorkspace?.error ? "quota unavailable" : `${quotas.get(client.id)?.available ?? 0} available`})</span></td><td className="px-4 py-3 text-ink-muted">-</td><td className="px-4 py-3 text-ink-muted">{formatDate(client.end_date)}</td><td className="px-4 py-3"><Badge tone={client.status === "active" ? "success" : "neutral"}>{client.status}</Badge></td><td className="px-4 py-3"><Link href={`/pt-clients/${client.id}`} className="text-xs text-primary hover:underline">Detail &amp; edit</Link></td></tr>)}</tbody></DataTable></div>}</Card>}<p className="mt-4 text-xs text-ink-faint">PT client memakai data Members yang sama; tidak ada database member terpisah.</p><Link href="/trainers" className="mt-2 inline-block text-xs text-primary hover:underline">← Kembali ke Trainer</Link></div>;
}
