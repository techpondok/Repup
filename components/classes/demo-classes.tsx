"use client";

import { useState } from "react";
import { useBranchDemo } from "@/components/branches/demo-provider";
import Link from "next/link";
import { useClasses } from "@/components/member/classes/class-provider";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader, Card, EmptyState, Stat } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { classAvailability, classDate, classDateKey, classTime, isPublishedClass } from "@/lib/member/classes";

export function DemoClasses({ view, canManage, canView, branchIds }: { view: string; canManage: boolean; canView: boolean; branchIds: string[] }) {
  const { state } = useClasses();
  const branchScope = useBranchDemo()?.scopedIds ?? branchIds;
  const [now] = useState(() => Date.now());
  if (!canView) return <EmptyState title="Classes are unavailable for this demo role" />;
  const today = classDateKey(new Date(now));
  const rows = state.schedules.filter(item => item.branchId && branchScope.includes(item.branchId)
    && (canManage || isPublishedClass(item)) && classDateKey(item.startsAt) >= today).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const tableRows = view === "bookings" ? rows.filter(isPublishedClass) : rows;

  return <div className="space-y-4">
    <PageHeader title="Kelas" description="Class types, schedule, bookings, and attendance."
      actions={<>{canManage && <LinkButton href="/classes/create">Create Class</LinkButton>}
        <LinkButton href="/member/classes" variant="secondary">Preview Member Classes</LinkButton></>} />
    <Card statGroup className="grid grid-cols-2 sm:grid-cols-4">
      <Stat label="Classes Today" value={String(rows.filter(item => isPublishedClass(item) && classDateKey(item.startsAt) === today).length)} />
      <Stat label="Upcoming Classes" value={String(rows.filter(item => isPublishedClass(item) && item.status === "scheduled" && Date.parse(item.startsAt) > now).length)} />
      <Stat label="Coaches Active" value={String(new Set(rows.filter(isPublishedClass).map(item => item.coach)).size)} />
      <Stat label="Bookings" value={String(rows.reduce((sum, item) => sum + item.enrolled, 0))} />
    </Card>
    <nav aria-label="Class Management" className="flex gap-1 border-b border-line">
      {[["classes", "Classes"], ["calendar", "Calendar"], ["bookings", "Bookings"]].map(([key, label]) => <Link key={key} href={key === "classes" ? "/classes" : `/classes?view=${key}`}
        aria-current={key === view ? "page" : undefined} className={`px-3 py-2 text-sm ${key === view ? "border-b-2 border-primary font-medium text-primary" : "text-ink-muted"}`}>{label}</Link>)}
    </nav>
    {state.success && ["Class draft saved.", "Class published."].includes(state.feedback) && <p role="status" className="rounded-lg bg-primary-tint p-3 text-sm">{state.feedback}</p>}
    {view === "calendar" ? <ScheduleCalendar title="Class calendar" initialDate={today} events={rows.map(item => ({
      id: item.id, title: item.name, date: classDateKey(item.startsAt), time: classTime(item.startsAt),
      description: `${item.coach} · ${item.branch} · ${item.studio}`, status: classAvailability(item, now),
      href: isPublishedClass(item) ? `/member/classes/${item.id}` : undefined,
    }))} /> : tableRows.length ? <Card>
      <DataTable className="min-w-[690px]">
        <thead><tr className="border-b border-line text-left text-xs text-ink-muted">
          {["Class", "Coach", "Schedule", "Booked / Capacity", ...(view === "bookings" ? ["Waiting List"] : []), "Status"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
        </tr></thead>
        <tbody>{tableRows.map(item => {
          const available = classAvailability(item, now);
          const booked = state.bookings.some(booking => booking.classId === item.id && booking.status === "confirmed");
          return <tr key={item.id} className="border-b border-line last:border-0">
            <td className="px-4 py-3 font-medium">{isPublishedClass(item) ? <Link className="hover:text-primary" href={`/member/classes/${item.id}`}>{item.name}</Link> : item.name}</td>
            <td className="px-4 py-3 text-ink-muted">{item.coach}</td>
            <td className="px-4 py-3 text-ink-muted">{classDate(item.startsAt)} · {classTime(item.startsAt)} WIB · {item.branch} / {item.studio}</td>
            <td className="px-4 py-3">{item.enrolled} / {item.capacity}</td>
            {view === "bookings" && <td className="px-4 py-3">{state.waitlist.filter(entry => entry.classId === item.id).length}</td>}
            <td className="px-4 py-3"><Badge tone={available === "Cancelled" ? "danger" : available === "Almost Full" ? "warning" : "neutral"}>{available}</Badge>
              {booked && <p className="mt-1 text-xs text-ink-muted">Demo member booked</p>}</td>
          </tr>;
        })}</tbody>
      </DataTable>
    </Card> : <EmptyState title="No classes scheduled" description="Create a class or switch to a branch with sessions." />}
  </div>;
}
