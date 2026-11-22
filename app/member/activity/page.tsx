"use client";

import { useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import { attendance, branches, gym, jakartaDate } from "@/lib/member/mock";

const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const visitDay = (value: string) => dateKey(jakartaDate(value));
const dateLabel = (value: string) => new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default function MemberActivityPage() {
  const [period, setPeriod] = useState("month");
  const [branch, setBranch] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [limit, setLimit] = useState(6);
  const [calendar, setCalendar] = useState(() => new Date(jakartaDate(new Date()).getFullYear(), jakartaDate(new Date()).getMonth(), 1));
  const now = jakartaDate(new Date());
  const today = dateKey(now);
  const monthStart = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const weekStart = dateKey(weekStartDate);
  const sorted = [...attendance].sort((a, b) => b.date.localeCompare(a.date));
  const monthVisits = sorted.filter(item => visitDay(item.date) >= monthStart && visitDay(item.date) <= today);
  const filtered = sorted.filter(item => {
    const day = visitDay(item.date);
    const matchesBranch = branch === "all" || item.branch === branch;
    const matchesDate = period === "today" ? day === today : period === "week" ? day >= weekStart && day <= today : period === "month" ? day >= monthStart && day <= today : (!start || day >= start) && (!end || day <= end);
    return matchesBranch && matchesDate;
  });
  const year = calendar.getFullYear();
  const month = calendar.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const visited = new Set(sorted.map(item => visitDay(item.date)));
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const endDate = new Date(weekStartDate); endDate.setDate(endDate.getDate() - (3 - index) * 7 + 6);
    const beginDate = new Date(endDate); beginDate.setDate(beginDate.getDate() - 6);
    return { label: beginDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), count: sorted.filter(item => visitDay(item.date) >= dateKey(beginDate) && visitDay(item.date) <= dateKey(endDate)).length };
  });
  const average = (weeks.reduce((sum, week) => sum + week.count, 0) / 4).toFixed(1);

  return <div className="space-y-7">
    <div><p className="mp-muted text-sm mb-2">YOUR CONSISTENCY, IN NUMBERS</p><h1 className="mp-title">Every visit counts.</h1><p className="mp-muted mt-3">A little progress, every time you show up.</p></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {[{ label: "Total visits", value: sorted.length, note: "Since joining", icon: Activity }, { label: "This month", value: monthVisits.length, note: "Keep the momentum", icon: ArrowUpRight }, { label: "Last visit", value: sorted[0] ? dateLabel(sorted[0].date).replace(` ${now.getFullYear()}`, "") : "—", note: sorted[0]?.branch || "Your first visit awaits", icon: CalendarDays }, { label: "Weekly average", value: average, note: "Over the last 4 weeks", icon: Clock3 }].map(stat => <section className="mp-card min-w-0" key={stat.label}><div className="flex justify-between items-center gap-2"><p className="mp-muted text-sm">{stat.label}</p><stat.icon size={17} aria-hidden="true" /></div><p className="text-2xl sm:text-3xl font-semibold tracking-tight my-4 break-words">{stat.value}</p><p className="mp-muted text-xs">{stat.note}</p></section>)}
    </div>
    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <section className="mp-card min-w-0"><div className="flex items-center justify-between gap-3 mb-5"><h2 className="mp-section-title">Attendance history</h2><span className="mp-badge">{filtered.length} visits</span></div>
        <div className="flex flex-wrap gap-2 mb-4">{[["today", "Today"], ["week", "This week"], ["month", "This month"], ["custom", "Custom"]].map(([value, label]) => <button className={`mp-button ${period === value ? "" : "secondary"}`} key={value} aria-pressed={period === value} onClick={() => { setPeriod(value); setLimit(6); }}>{label}</button>)}</div>
        <label className="block text-sm mb-5">Branch<select className="mp-field block w-full mt-2" value={branch} onChange={event => { setBranch(event.target.value); setLimit(6); }}><option value="all">All branches</option>{branches.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
        {period === "custom" && <div className="grid sm:grid-cols-2 gap-3 mb-5"><label className="text-sm">From<input className="mp-field block w-full mt-2" type="date" value={start} max={end || today} onChange={event => setStart(event.target.value)} /></label><label className="text-sm">Until<input className="mp-field block w-full mt-2" type="date" value={end} min={start} max={today} onChange={event => setEnd(event.target.value)} /></label>{start && end && start > end && <p role="alert" className="text-red-500 text-sm sm:col-span-2">End date must be after the start date.</p>}</div>}
        <div className="space-y-3">{filtered.slice(0, limit).map(item => <article key={item.id} className="border border-[var(--line)] rounded-xl p-4"><div className="flex justify-between gap-3 items-start"><div className="flex gap-3 min-w-0"><span className="rounded-lg p-2 h-fit bg-[var(--primary-tint)] text-[var(--primary)]"><ArrowDownRight size={19} aria-hidden="true" /></span><div className="min-w-0"><h3 className="font-semibold text-sm">{dateLabel(item.date)}</h3><p className="mp-muted text-xs mt-1 flex gap-1 items-center"><MapPin size={12} aria-hidden="true" />{gym.name} · {item.branch}</p></div></div><span className="mp-badge text-xs shrink-0">{item.status}</span></div><div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs"><span><span className="mp-muted">In </span>{item.checkIn}</span><span><span className="mp-muted">Out </span>{item.checkOut || "In progress"}</span><span><span className="mp-muted">Duration </span>{item.duration || "—"}</span><span className="mp-muted">{item.method}</span></div></article>)}</div>
        {!filtered.length && <div className="text-center py-12"><CalendarDays size={32} className="mx-auto mb-4 mp-muted" /><h3 className="font-semibold">No visits in this period</h3><p className="mp-muted text-sm mt-2">Try another date or branch. Your next workout is waiting.</p><button className="mp-button secondary mt-5" onClick={() => { setPeriod("custom"); setStart(""); setEnd(""); setBranch("all"); }}>Show all visits</button></div>}
        {filtered.length > limit && <button className="mp-button secondary w-full mt-5" onClick={() => setLimit(value => value + 6)}>Load more visits</button>}
      </section>
      <div className="space-y-5"><section className="mp-card"><div className="flex items-center justify-between mb-5 gap-2"><h2 className="mp-section-title">{calendar.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><div className="flex"><button className="mp-button secondary !p-2" aria-label="Previous month" onClick={() => setCalendar(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button><button className="mp-button secondary !p-2" aria-label="Next month" onClick={() => setCalendar(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button></div></div><div className="grid grid-cols-7 gap-1 text-center text-xs">{["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <span key={i} className="mp-muted py-2">{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: days }, (_, i) => { const key = dateKey(new Date(year, month, i + 1)); const checked = visited.has(key); return <span title={`${key}${checked ? ": gym visit" : ""}`} key={key} className={`aspect-square flex items-center justify-center rounded-lg ${checked ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-bold" : ""} ${key === today ? "ring-1 ring-[var(--primary)]" : ""}`}>{i + 1}</span>; })}</div><p className="mp-muted text-xs mt-4"><span className="inline-block w-2 h-2 rounded-sm bg-[var(--primary)] mr-2" />Workout day</p></section>
        <section className="mp-card"><h2 className="mp-section-title mb-2">Your weekly rhythm</h2><p className="mp-muted text-xs">Visits over the last four weeks</p><div className="flex h-36 items-end gap-4 mt-5">{weeks.map(week => <div className="flex-1 flex flex-col items-center justify-end h-full gap-2" key={week.label}><span className="text-xs font-semibold">{week.count}</span><div className="w-full max-w-10 rounded-t-md bg-[var(--primary)]" style={{ height: `${Math.max(4, week.count / Math.max(1, ...weeks.map(w => w.count)) * 80)}px` }} /><span className="mp-muted text-[10px] whitespace-nowrap">{week.label}</span></div>)}</div></section>
      </div>
    </div>
  </div>;
}
