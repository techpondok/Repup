import Link from "next/link";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { calendarDayKey } from "@/lib/calendar";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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

export function PtCalendar({ sessions, weekStart }: { sessions: PtCalendarSession[]; weekStart: Date }) {
  const start = isoDate(weekStart);
  const end = isoDate(new Date(weekStart.getTime()+6*86400000));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-muted">Sesi yang dimuat: {start} - {end} (WIB). Pilih minggu untuk memuat jadwal lainnya.</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/pt-clients?view=calendar&date=${isoDate(new Date(weekStart.getTime()-7*86400000))}`} className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface">Minggu lalu</Link>
        <Link href={`/pt-clients?view=calendar&date=${calendarDayKey(new Date())}`} className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface">Minggu ini</Link>
        <Link href={`/pt-clients?view=calendar&date=${isoDate(new Date(weekStart.getTime()+7*86400000))}`} className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface">Minggu depan</Link>
      </div>
    </div>
    <form action="/pt-clients" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="view" value="calendar"/>
      <label className="block text-sm text-ink">Lompat ke minggu<Input type="date" name="date" defaultValue={start} className="mt-2" required/></label>
      <Button type="submit" variant="secondary">Lihat minggu</Button>
    </form>
    <ScheduleCalendar key={start} title="Kalender PT" initialDate={start} events={sessions.map(session=>({id:session.id,title:session.members?.full_name ?? "Member",date:session.session_date,time:session.start_time?.slice(0,5),description:`${session.duration_minutes} menit | Trainer: ${session.trainers?.full_name ?? "-"}`,status:session.status,href:`/pt-clients/${session.pt_client_assignment_id}`}))}/>
  </div>;
}
