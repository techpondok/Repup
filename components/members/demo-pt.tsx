"use client";

import { useState, type FormEvent } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { TrainerDrawer } from "@/components/trainers/trainer-drawer";
import { activity, addDays, current, status, type PtBooking } from "@/lib/demo/member-management";
import { ptPackages, ptSlots, trainers } from "@/lib/member/pt";
import { Field, Footer } from "./demo-forms";
import { useMemberDemo } from "./demo-provider";
import { useBranchDemo } from "@/components/branches/demo-provider";
import type { DemoScope } from "./demo-scope";
import { dateTimeLabel, MemberTable } from "./demo-ui";

export function DemoMemberPT({ id, view, ...initialScope }: DemoScope & { id: string; view: "calendar" | "bookings" }) {
  const branch = useBranchDemo();
  const scope = branch ? { ...initialScope, branchIds: branch.scopedIds, branchId: branch.scope?.id ?? branch.scopedIds[0] ?? "" } : initialScope;
  const demo = useMemberDemo();
  const [selected, setSelected] = useState<PtBooking | null>(null);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const member = demo.members.find(item => item.id === id && scope.branchIds.includes(item.branchId));
  const trainer = trainers.find(item => item.id === member?.pt?.trainerId);
  const plan = ptPackages.find(item => item.id === member?.pt?.packageId);
  if (!scope.canView || !scope.canViewPT || !member?.pt || !trainer || !plan) return <EmptyState title="PT schedule unavailable" action={<LinkButton href="/members">Back to Members</LinkButton>} />;

  const sessions = member.pt.bookings;
  const minDate = addDays(demo.today, 1);
  const slots = ptSlots.filter(slot => slot.trainerId === trainer.id && slot.available);
  const list = `/pt-clients?view=bookings&member=${id}`;
  const calendar = `/pt-clients?view=calendar&member=${id}`;
  const available = plan.sessions - sessions.filter(item => item.status !== "Cancelled").length;

  function cancel() {
    if (!selected) return;
    demo.update(items => items.map(item => {
      if (item.id !== id || !item.pt) return item;
      const bookings = item.pt.bookings.map(entry => entry.id === selected.id ? { ...entry, status: "Cancelled" as const } : entry);
      return activity({ ...item, pt: { ...item.pt, bookings } }, "PT Booking Cancelled", selected.id);
    }));
    setSelected(null);
    setMessage("Demo booking cancelled. One session is available again.");
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date"));
    const time = String(data.get("time"));
    const at = `${date}T${time}:00+07:00`;
    if (!member || !trainer || !plan) return;
    if (!["Active", "Expiring Soon"].includes(status(member, demo.today)) || date > current(member, demo.today).end) {
      return setError("Choose a date covered by an active gym membership.");
    }
    if (date < minDate || !slots.some(slot => slot.time === time)) return setError("Choose an available future slot.");
    if (demo.members.some(item => item.pt?.trainerId === trainer.id && item.pt.bookings.some(entry => entry.status === "Reserved" && entry.at === at))) {
      return setError("This trainer already has a booking in that slot.");
    }
    if (available <= 0) return setError("All sessions are used or reserved.");
    const createdAt = new Date().toISOString();
    const entry: PtBooking = { id: `PT-${crypto.randomUUID().slice(0, 8)}`, at, createdAt, status: "Reserved" };
    demo.update(items => items.map(item => item.id === id && item.pt ? activity({
      ...item, pt: { ...item.pt, bookings: [entry, ...item.pt.bookings] },
    }, "PT Session Reserved", `${entry.id} · ${trainer.name}`, createdAt) : item));
    setBooking(false);
    setMessage("Demo PT session reserved.");
  }

  return <div className="space-y-4">
    <PageHeader title={view === "calendar" ? "Member PT Schedule" : "Member PT Bookings"}
      description={`${member.name} · ${trainer.name} · ${available} sessions available`}
      actions={<><LinkButton href={`/members/${id}?tab=personal-training`} variant="secondary">Back to Member</LinkButton>
        <LinkButton href={view === "calendar" ? list : calendar} variant="secondary">{view === "calendar" ? "Manage Booking" : "View Schedule"}</LinkButton>
        {view === "bookings" && scope.canManagePT && <Button onClick={() => { setError(""); setBooking(true); }} disabled={!available}>Reserve Session</Button>}
      </>} />
    {message && <p role="status" className="rounded-lg bg-primary-tint p-3 text-sm">{message}</p>}
    {view === "calendar" ? <ScheduleCalendar title="PT Schedule" initialDate={demo.today} events={sessions.filter(item => item.status !== "Cancelled").map(item => ({
      id: item.id, title: `${plan.name} · ${trainer.name}`, date: item.at.slice(0, 10), time: item.at.slice(11, 16), status: item.status,
    }))} /> : <Card><MemberTable headers={["Booking", "Date & Time", "Status", "Action"]} mobile
      rows={sessions.map(item => ({ id: item.id, cells: [item.id, dateTimeLabel(item.at), item.status,
        scope.canManagePT && item.status === "Reserved" && item.at.slice(0, 10) >= demo.today ? <Button key="cancel" variant="secondary" size="sm" onClick={() => setSelected(item)}>Cancel Booking</Button> : "—",
      ] }))} empty="No PT bookings" /></Card>}
    {selected && <ConfirmDialog open title="Cancel PT booking?" description={`Cancel the session on ${dateTimeLabel(selected.at)} and release its reserved slot.`}
      confirmLabel="Cancel Booking" onClose={() => setSelected(null)} onConfirm={cancel} />}
    {booking && <TrainerDrawer title="Reserve PT Session" onClose={() => setBooking(false)} centered>
      <form className="space-y-4" onSubmit={create}>
        <p className="text-sm text-ink-muted">Book with fixed trainer {trainer.name} in WIB.</p>
        <Field label="Session Date"><Input type="date" name="date" min={minDate} required /></Field>
        <Field label="Available Time"><Select name="time" required>{slots.map(slot => <option key={slot.time}>{slot.time}</option>)}</Select></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Footer close={() => setBooking(false)} label="Reserve Session" />
      </form>
    </TrainerDrawer>}
  </div>;
}
