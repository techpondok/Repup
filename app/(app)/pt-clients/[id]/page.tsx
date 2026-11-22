import Link from "next/link";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { calendarDayKey } from "@/lib/calendar";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { EditPtSessionForm, SchedulePtModal } from "@/components/personal-training/schedule-pt-modal";

export default async function PtClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  const { id } = await params;
  if (ctx.isDemo) {
    const members = [
      {id:"yudha-wahyu",name:"Yudha Wahyu",trainer:"Andi Wijaya",plan:"PT 12 Sessions",used:4,total:12},
      {id:"siti-rahma",name:"Siti Rahma",trainer:"Andi Wijaya",plan:"PT 8 Sessions",used:6,total:8},
      {id:"budi-santoso",name:"Budi Santoso",trainer:"Raka Pratama",plan:"PT 12 Sessions",used:10,total:12},
    ];
    const index = members.findIndex(member=>member.id===id);
    const member = members[index];
    if (!member) notFound();
    const date = calendarDayKey(new Date(new Date().getTime()+index*86400000));
    const time = index===0?"18:00":"10:00";
    return <div className="space-y-5"><PageHeader title={member.name} description={`PT Client | Trainer: ${member.trainer}`}/><Card className="grid gap-4 p-5 sm:grid-cols-4"><div><p className="text-xs text-ink-faint">Status</p><p className="mt-1 font-medium text-primary">ACTIVE</p></div><div><p className="text-xs text-ink-faint">PT Package</p><p className="mt-1 font-medium text-ink">{member.plan}</p></div><div><p className="text-xs text-ink-faint">Sessions</p><p className="mt-1 font-medium text-ink">{member.used} Used | {member.total-member.used} Remaining</p></div><div><p className="text-xs text-ink-faint">Next Session</p><p className="mt-1 font-medium text-ink">{date} | {time}</p></div></Card><ScheduleCalendar title="Jadwal member PT" initialDate={date} events={[{id:`demo-session-${id}`,title:`PT - ${member.name}`,date,time,description:`Trainer: ${member.trainer} | 60 menit`,status:"scheduled"}]}/><Link href="/pt-clients" className="inline-block min-h-10 text-sm text-primary hover:underline">Kembali ke PT Clients</Link></div>;
  }
  const supabase = await createClient();
  const { data: assignment } = await supabase.from("pt_client_assignments").select("*, members(full_name, member_code), trainers(full_name), branches(name)").eq("id", id).eq("organization_id", ctx.organization.id).single();
  if (!assignment) notFound();
  const { data: sessions } = await supabase.from("pt_sessions").select("*").eq("pt_client_assignment_id", id).order("scheduled_at", { ascending: true });
  const assignmentOption = [{ id, member: (assignment as any).members?.full_name ?? "Member", trainer: (assignment as any).trainers?.full_name ?? "Trainer", locationId: (assignment as any).location_id, location: (assignment as any).branches?.name ?? "Lokasi" }];
  return <div><PageHeader title={(assignment as any).members?.full_name ?? "PT Client"} description={`PT Client · Trainer: ${(assignment as any).trainers?.full_name ?? "-"}`} actions={<SchedulePtModal assignments={assignmentOption} locationId={(assignment as any).location_id} />} /><Card className="mb-6 grid gap-4 sm:grid-cols-4"><div><p className="text-xs text-ink-faint">Status</p><p className="mt-1 font-medium text-primary">{(assignment as any).status}</p></div><div><p className="text-xs text-ink-faint">Location</p><p className="mt-1 font-medium text-ink">{(assignment as any).branches?.name}</p></div><div><p className="text-xs text-ink-faint">Sessions</p><p className="mt-1 font-medium text-ink">{(assignment as any).sessions_used} Used · {(assignment as any).sessions_total - (assignment as any).sessions_used} Remaining</p></div><div><p className="text-xs text-ink-faint">Validity</p><p className="mt-1 font-medium text-ink">{(assignment as any).start_date} – {(assignment as any).end_date ?? "-"}</p></div></Card><div className="mb-5"><ScheduleCalendar title="Jadwal member PT" events={(sessions ?? []).map((session: any)=>({id:session.id,title:(assignment as any).members?.full_name ?? "PT Session",date:session.session_date ?? session.scheduled_at?.slice(0,10),time:session.start_time?.slice(0,5),description:`${session.duration_minutes ?? 60} menit | Trainer: ${(assignment as any).trainers?.full_name ?? "-"}`,status:session.status}))}/></div><Card><h2 className="mb-4 text-lg font-semibold text-ink">Sessions</h2>{!sessions?.length ? <EmptyState title="Belum ada sesi" /> : <div className="space-y-4">{sessions.map((session: any) => <div key={session.id} className="grid gap-4 border-b border-line pb-4 last:border-0 md:grid-cols-[1fr_22rem]"><div><p className="font-medium text-ink">{session.session_date} · {session.start_time?.slice(0, 5)}</p><p className="mt-1 text-xs text-ink-muted">{session.duration_minutes} menit</p><Badge tone={session.status === "completed" ? "success" : session.status === "cancelled" ? "danger" : "info"}>{session.status}</Badge></div><EditPtSessionForm session={session} /></div>)}</div>}</Card><Link href="/pt-clients" className="mt-4 inline-block text-xs text-primary hover:underline">← Kembali ke PT Clients</Link></div>;
}
