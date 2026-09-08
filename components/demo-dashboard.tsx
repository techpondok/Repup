import Link from "next/link";
import { Card, Stat } from "@/components/ui/layout-bits";
import type { TenantContext } from "@/lib/tenant";
import { DEMO_ROLES, hasDemoPermission } from "@/lib/demo/roles";

const classes = [["07:00", "Morning Yoga", "12 / 15"], ["09:00", "Pilates Reformer", "8 / 8"], ["17:00", "Boxing Fundamentals", "14 / 20"]];

export default function DemoDashboard({ ctx }: { ctx: TenantContext }) {
  const role = ctx.demoRole ?? "OWNER";
  const config = DEMO_ROLES[role];
  const isCoach = role === "COACH";
  const isTrainer = role === "TRAINER";
  const isMember = role === "MEMBER";
  const location = ctx.branch?.name ?? "Semua lokasi";
  const stats = isTrainer ? [["My PT Clients", "2"], ["Sessions Today", "2"], ["This Week", "6"], ["Next Session", "18:00"]] : isCoach ? [["Kelas Hari Ini", "3"], ["Member Kelas", "34"], ["Attendance Hari Ini", "27"], ["Upcoming Class", "17:00"]] : isMember ? [["Membership", "Active"], ["Kelas Diikuti", "12"], ["Check-in Bulan Ini", "8"], ["Sesi Tersisa", "6"]] : role === "MANAGER" ? [["Check-in Hari Ini", "21"], ["Member Aktif", "146"], ["Renewal Opportunity", "12"], ["Pendapatan Bulan Ini", "Rp16,4jt"]] : [["Check-in Hari Ini", "63"], ["Member Aktif", "427"], ["Renewal Opportunity", "43"], ["Pendapatan Bulan Ini", "Rp48,25jt"]];

  return <div>
    <div className="mb-6 flex items-start justify-between"><div><p className="text-xs uppercase tracking-widest text-primary">Demo mode · {location}</p><h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">Selamat Pagi, {ctx.profile.full_name}</h1><p className="mt-1 text-sm text-ink-muted">{config.name} · {ctx.organization.name} · Sample data</p></div><Link href="/register" className="rounded-[6px] bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Mulai RepUp</Link></div>
    <Card className="mb-6 grid grid-cols-2 sm:grid-cols-4">{stats.map(([label, value]) => <Stat key={label} label={label} value={value} />)}</Card>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Card><div className="flex items-center justify-between border-b border-line px-5 py-3"><p className="text-sm font-medium text-ink">{isCoach ? "Attendance 30 Hari" : "Pendapatan 30 Hari"}</p><span className="text-xs text-success">+12,4%</span></div><div className="flex h-48 items-end gap-2 px-5 py-6">{[30,42,35,50,46,60,54,70,64,78,72,91,84,98].map((height, i)=><i key={i} className="flex-1 bg-primary" style={{height: `${height}%`}} />)}</div></Card><Card><div className="flex items-center justify-between border-b border-line px-5 py-3"><p className="text-sm font-medium text-ink">{isCoach ? "Kelas Hari Ini" : "Renewal Opportunity"}</p><span className="text-xs font-medium text-primary">{isCoach ? "3 kelas" : "43 member"}</span></div><div className="p-5"><p className="num text-3xl font-semibold text-ink">{isCoach ? "5 sesi" : "Rp14.800.000"}</p><p className="mt-2 text-sm leading-relaxed text-ink-muted">{isCoach ? "Jadwal dan attendance client yang perlu diperhatikan." : "Potensi pendapatan dari membership yang segera berakhir."}</p><Link href={isCoach ? "/classes" : "/memberships"} className="mt-5 inline-block text-xs font-medium text-primary hover:underline">Buka detail →</Link></div></Card></div>
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"><Card><div className="border-b border-line px-5 py-3"><p className="text-sm font-medium text-ink">{isCoach ? "Jadwal Saya" : "Kelas Hari Ini"}</p></div>{classes.map(([time, name, count])=><div key={name} className="flex items-center justify-between border-b border-line px-5 py-3 text-sm last:border-0"><span className="num text-xs text-ink-faint">{time}</span><b className="flex-1 px-4 font-medium text-ink">{name}</b><span className="text-xs text-primary">{count}</span></div>)}</Card><Card><div className="border-b border-line px-5 py-3"><p className="text-sm font-medium text-ink">{isCoach ? "Client Saya" : "Members Need Attention"}</p></div><div className="space-y-4 p-5 text-sm"><p><b className="text-ink">Budi Santoso</b><span className="block text-xs text-ink-muted">{isCoach ? "Program strength · sesi berikutnya hari ini" : "Tidak hadir selama 10 hari · Needs attention"}</span></p><p><b className="text-ink">Siti Rahma</b><span className="block text-xs text-ink-muted">{isCoach ? "Pilates · 2 sesi tersisa" : "Sisa 2 sesi Pilates · Low balance"}</span></p>{hasDemoPermission(role, "reports.view") && <Link href="/reports" className="inline-block text-xs font-medium text-primary hover:underline">Buka laporan →</Link>}</div></Card></div>
  </div>;
}
