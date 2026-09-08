import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";

type PtCalendarSession = {
  id: string;
  pt_client_assignment_id: string;
  session_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  members?: { full_name?: string } | null;
  trainers?: { full_name?: string } | null;
};

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function dayLabel(date: Date) { return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric" }).format(date); }
function timeLabel(value: string) { return value?.slice(0, 5) ?? ""; }

export function PtCalendar({ sessions, weekStart }: { sessions: PtCalendarSession[]; weekStart: Date }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; });
  const dayMap = new Map(days.map((day) => [isoDate(day), sessions.filter((session) => session.session_date === isoDate(day))]));
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-medium text-ink">Jadwal PT</p><p className="text-xs text-ink-muted">Minggu {dayLabel(days[0])} – {dayLabel(days[6])}</p></div>
      <div className="flex gap-1 text-xs"><Link href={`/pt-clients?view=calendar&date=${isoDate(new Date(weekStart.getTime() - 7 * 86400000))}`} className="rounded border border-line px-2 py-1 text-ink-muted hover:text-primary">‹ Minggu lalu</Link><Link href={`/pt-clients?view=calendar&date=${isoDate(new Date())}`} className="rounded border border-line px-2 py-1 text-ink-muted hover:text-primary">Minggu ini</Link><Link href={`/pt-clients?view=calendar&date=${isoDate(new Date(weekStart.getTime() + 7 * 86400000))}`} className="rounded border border-line px-2 py-1 text-ink-muted hover:text-primary">Minggu depan ›</Link></div>
    </div>
    {!sessions.length ? <Card><EmptyState title="Belum ada sesi di minggu ini" description="Jadwalkan sesi dari halaman client atau tombol Schedule PT." /></Card> : <div className="overflow-x-auto"><div className="grid min-w-[980px] grid-cols-[4rem_repeat(7,minmax(0,1fr))] border-l border-t border-line">
      <div className="border-b border-r border-line p-2 text-[10px] text-ink-faint">WIB</div>{days.map((day) => <div key={isoDate(day)} className="border-b border-r border-line p-2 text-center text-xs font-medium text-ink">{dayLabel(day)}</div>)}
      {Array.from({ length: 16 }, (_, hourIndex) => { const hour = hourIndex + 7; return <><div key={`h-${hour}`} className="h-20 border-b border-r border-line p-2 text-[10px] text-ink-faint">{String(hour).padStart(2, "0")}:00</div>{days.map((day) => { const events = (dayMap.get(isoDate(day)) ?? []).filter((session) => Number(session.start_time?.slice(0, 2)) === hour); return <div key={`${isoDate(day)}-${hour}`} className="h-20 border-b border-r border-line p-1">{events.map((session) => <Link key={session.id} href={`/pt-clients/${session.pt_client_assignment_id}`} className="block rounded border border-primary/30 bg-primary/10 p-1.5 text-[11px] hover:bg-primary/20"><p className="truncate font-medium text-ink">{session.members?.full_name ?? "Member"}</p><p className="text-ink-muted">{timeLabel(session.start_time)} · {session.duration_minutes}m</p><Badge tone={session.status === "completed" ? "success" : session.status === "cancelled" ? "danger" : "info"}>{session.status}</Badge></Link>)}</div>;})}</>; })}
    </div></div>}
  </div>;
}
