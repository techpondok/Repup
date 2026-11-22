"use client";

import { useTrainerDemo } from "@/components/trainers/trainer-demo-provider";
import { useBranchDemo } from "@/components/branches/demo-provider";
import { Card, EmptyState } from "@/components/ui/layout-bits";
import { DataTable } from "@/components/ui/data-table";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { trainerBranchIds } from "@/lib/demo/branches";

export function DemoBranchPT({ view }: { view: string }) {
  const scope = useBranchDemo();
  const { details } = useTrainerDemo();
  const scopedIds = scope?.scopedIds ?? [];
  const trainers = (scope?.role === "TRAINER" ? details.filter(detail => detail.trainer.id === "demo-trainer-2") : details);
  const clients = trainers.flatMap(({ trainer, members }) => trainerBranchIds(trainer.id, trainer.branchIds).some(id => scopedIds.includes(id))
    ? members.map(member => ({ trainer, member })) : []);
  const bookings = trainers.flatMap(({ trainer, sessions }) => sessions.flatMap(session => {
    const branchId = session.branchId ?? trainerBranchIds(trainer.id, trainer.branchIds)[0];
    const branch = scope?.active.find(item => item.id === branchId && scopedIds.includes(item.id));
    return branch ? [{ trainer, session, branch }] : [];
  }));
  if (view === "calendar") return <ScheduleCalendar title="PT Calendar" events={bookings.map(({ trainer, session, branch }) => ({
    id: session.id, title: session.memberName, date: session.date, time: session.start, description: trainer.name + " · " + branch.name, status: session.status,
  }))} />;
  if (view === "bookings") return bookings.length ? <Card><DataTable className="w-full min-w-[620px] text-sm">
    <thead><tr className="border-b border-line text-left">{["Member", "Trainer", "Branch", "Schedule", "Status"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
    <tbody>{bookings.map(({ trainer, session, branch }) => <tr key={session.id} className="border-b border-line last:border-0">{[session.memberName, trainer.name, branch.name, session.date + " " + session.start, session.status].map((value, index) => <td key={index} className="p-3">{value}</td>)}</tr>)}</tbody>
  </DataTable></Card> : <EmptyState title="No PT bookings in the selected branch." />;
  return clients.length ? <Card><DataTable className="w-full min-w-[520px] text-sm">
    <thead><tr className="border-b border-line text-left">{["Member", "Trainer", "Package", "Status"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
    <tbody>{clients.map(({ trainer, member }) => <tr key={trainer.id + member.id} className="border-b border-line last:border-0">{[member.name, trainer.name, member.packageName ?? "—", member.status].map((value, index) => <td key={index} className="p-3">{value}</td>)}</tr>)}</tbody>
  </DataTable></Card> : <EmptyState title="No PT clients in the selected branch." />;
}
