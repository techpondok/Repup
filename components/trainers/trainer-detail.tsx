"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { loadPtSlots } from "@/app/actions/pt-bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Card, EmptyState } from "@/components/ui/layout-bits";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import { formatCurrency } from "@/lib/format";
import { openSession, type Availability, type ManagedTrainer, type TrainerDetail, type TrainerSession } from "@/lib/trainer-management";
import { TrainerAvailability } from "./trainer-availability";
import { TrainerDrawer } from "./trainer-drawer";
import { TrainerPhoto } from "./managed-trainer-form";

export const trainerStatusLabels = { active: "Active", inactive: "Inactive", on_leave: "On Leave" } as const;
export const employmentLabels = { full_time: "Full-time", part_time: "Part-time", freelance: "Freelance" } as const;
export function TrainerStatus({ status }: { status: ManagedTrainer["status"] }) {
  return <Badge tone={status === "active" ? "success" : status === "on_leave" ? "warning" : "neutral"}>{trainerStatusLabels[status]}</Badge>;
}

function LabeledValue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words text-sm">{children === "" ? "—" : children ?? "—"}</dd></div>;
}

function timeLabel(session: TrainerSession, zone: string) {
  return `${session.date} · ${session.start.slice(0, 5)}–${session.end.slice(0, 5)} · ${zone}`;
}

function withinWeek(date: string, anchor: string) {
  const monday = new Date(`${anchor}T00:00:00Z`);
  if (Number.isNaN(monday.getTime())) return false;
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return date >= monday.toISOString().slice(0, 10) && date < nextMonday.toISOString().slice(0, 10);
}

function sessionStatus(session: TrainerSession, now: number) {
  if (session.status === "pending_approval" && session.approvalExpiresAt && Date.parse(session.approvalExpiresAt) <= now) return "expired";
  return session.status === "scheduled" ? "confirmed" : session.status;
}

function sessionSummary(session: TrainerSession, now: number, zone: string) {
  const duration = Math.round((Date.parse(`${session.date}T${session.end.slice(0, 5)}:00Z`) - Date.parse(`${session.date}T${session.start.slice(0, 5)}:00Z`)) / 60000);
  return <div className="min-w-0">
    <p className="break-words text-sm font-medium">{session.memberName}</p>
    <p className="text-xs text-ink-muted">{timeLabel(session, zone)} · {duration > 0 ? `${duration} min · ` : ""}<span className="capitalize">{sessionStatus(session, now).replaceAll("_", " ")}</span></p>
    {session.packageName && <p className="mt-1 text-xs text-ink-muted">{session.packageName}</p>}
  </div>;
}

export type TrainerSessionOperation = "reschedule" | "cancel" | "approve" | "reject";
const operationLabels: Record<TrainerSessionOperation, { title: string; confirm: string; notice: string; reason: string }> = {
  reschedule: { title: "Reschedule Session", confirm: "Confirm Reschedule", notice: "Session rescheduled.", reason: "Reschedule Reason" },
  cancel: { title: "Cancel Session", confirm: "Confirm Cancellation", notice: "Session cancelled.", reason: "Cancellation Reason" },
  approve: { title: "Approve Booking", confirm: "Approve Booking", notice: "Booking approved.", reason: "Approval Notes" },
  reject: { title: "Reject Booking", confirm: "Reject Booking", notice: "Booking rejected.", reason: "Rejection Reason" },
};

function addMinutes(time: string, minutes: number) {
  if (!time || !Number.isFinite(minutes)) return "";
  const [hours, startMinutes] = time.split(":").map(Number);
  const end = hours * 60 + startMinutes + minutes;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

function SessionChange({ operation, session, trainer, actor, demo, zone, onClose, onSave }: {
  operation: TrainerSessionOperation;
  session: TrainerSession;
  trainer: string;
  actor: string;
  demo: boolean;
  zone: string;
  onClose: () => void;
  onSave: (date: string, start: string, end: string, reason: string) => Promise<{ error?: string }>;
}) {
  const changing = operation === "reschedule";
  const { title, confirm, reason: reasonLabel } = operationLabels[operation];
  const usesSlots = changing && !demo;
  const [date, setDate] = useState(session.date);
  const [start, setStart] = useState(usesSlots ? "" : session.start.slice(0, 5));
  const [end, setEnd] = useState(session.end.slice(0, 5));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [slotResponse, setSlotResponse] = useState<{ date: string; slots: string[]; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const chosenSlots = slotResponse?.date === date ? slotResponse : null;
  const duration = Math.round((Date.parse(`${session.date}T${session.end.slice(0, 5)}:00Z`) - Date.parse(`${session.date}T${session.start.slice(0, 5)}:00Z`)) / 60000);
  const previewEnd = usesSlots ? addMinutes(start, duration) : end;

  useEffect(() => {
    if (!usesSlots || !date || !session.assignmentId) return;
    let cancelled = false;
    loadPtSlots(session.assignmentId, date, session.id).then(result => {
      if (!cancelled) setSlotResponse({ date, ...result });
    }).catch(() => {
      if (!cancelled) setSlotResponse({ date, slots: [], error: "Could not load available times." });
    });
    return () => { cancelled = true; };
  }, [date, usesSlots, session.assignmentId, session.id, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if ((operation !== "approve" && !reason.trim()) || (changing && (!date || !start || !previewEnd || previewEnd <= start || (usesSlots && !chosenSlots?.slots.includes(start))))) {
      setError(changing ? "Enter a reason and choose an available time." : "Enter a reason.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await onSave(date, start, previewEnd, reason.trim());
      if (result.error) setError(result.error);
    } catch {
      setError("Could not update the session. Try again.");
    } finally {
      setPending(false);
    }
  }

  return <TrainerDrawer title={title} centered onClose={() => { if (!pending) onClose(); }}>
    <form onSubmit={submit} className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3">
        <LabeledValue label="Trainer">{trainer}</LabeledValue>
        <LabeledValue label="Member">{session.memberName}</LabeledValue>
        <LabeledValue label="Current Schedule">{timeLabel(session, zone)}</LabeledValue>
        {operation === "cancel" && <LabeledValue label="Cancelled By">{actor}</LabeledValue>}
      </dl>
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        {changing && <>
          <label className="block text-sm">New Date<Input className="mt-1 min-w-0" required type="date" value={date} onChange={event => { setDate(event.target.value); if (usesSlots) setStart(""); }} /></label>
          {usesSlots ? <div className="space-y-2">
            <label className="block text-sm">Available time slots<Select className="mt-1" required disabled={!chosenSlots?.slots.length} value={start} onChange={event => setStart(event.target.value)}>
              <option value="">Choose a time</option>
              {chosenSlots?.slots.map(time => <option key={time} value={time}>{time}</option>)}
            </Select></label>
            {!session.assignmentId ? <p role="alert" className="text-sm text-danger">This booking has no package assignment.</p>
              : !date ? null : chosenSlots?.error ? <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="text-sm text-danger">{chosenSlots.error}</p>
                <Button type="button" size="sm" variant="secondary" onClick={() => { setSlotResponse(null); setRetry(value => value + 1); }}>Retry</Button>
              </div> : <p role="status" className="text-sm text-ink-muted">{!chosenSlots ? "Loading available times…" : chosenSlots.slots.length === 0 ? "No available sessions on this date. Please select another date." : ""}</p>}
          </div> : <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0 text-sm">New Start Time<Input className="mt-1 min-w-0" required type="time" value={start} onChange={event => setStart(event.target.value)} /></label>
            <label className="block min-w-0 text-sm">New End Time<Input className="mt-1 min-w-0" required type="time" value={end} onChange={event => setEnd(event.target.value)} /></label>
          </div>}
          <p className="rounded-lg border border-line bg-elevated p-3 text-sm"><strong>New schedule</strong><br />{date || "—"} · {start || "—"}–{previewEnd || "—"} · {zone}</p>
        </>}
        <label className="block text-sm">{reasonLabel}<Textarea className="mt-1" rows={3} value={reason} maxLength={300} required={operation !== "approve"} onChange={event => setReason(event.target.value)} /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Back</Button><Button type="submit" variant={operation === "cancel" || operation === "reject" ? "danger" : "primary"} disabled={pending || (usesSlots && (!start || !chosenSlots?.slots.includes(start)))}>{pending ? "Saving…" : confirm}</Button></div>
    </form>
  </TrainerDrawer>;
}

export function TrainerDetailPanel({ detail, actor, canManage, canEditSessions, demo, onEdit, onSaveAvailability, onSessionChange }: {
  detail: TrainerDetail;
  actor: string;
  canManage: boolean;
  canEditSessions: boolean;
  demo: boolean;
  onEdit: () => void;
  onSaveAvailability: (availability: Availability) => Promise<{ error?: string; conflicts?: number }>;
  onSessionChange: (operation: TrainerSessionOperation, id: string, date: string, start: string, end: string, reason: string) => Promise<{ error?: string }>;
}) {
  const [tab, setTab] = useState("Overview");
  const [sessionChange, setSessionChange] = useState<{ operation: TrainerSessionOperation; session: TrainerSession } | null>(null);
  const [notice, setNotice] = useState("");
  const [now] = useState(() => Date.now());
  const { trainer, sessions, members } = detail;
  const timezone = trainer.timezone ?? "Asia/Jakarta";
  const zone = timezone === "Asia/Jakarta" ? "WIB" : timezone;
  const dateAndTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone });
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).format(new Date(now));
  const [calendarView, setCalendarView] = useState<"Day" | "Week" | "Month">("Month");
  const [dateFilter, setDateFilter] = useState(today);
  const [bookingFilter, setBookingFilter] = useState<"All" | "Today" | "Upcoming" | "Completed" | "Cancelled">("Upcoming");
  const [viewBooking, setViewBooking] = useState<TrainerSession | null>(null);
  const panelId = useId();
  const tabs = ["Overview", "Schedule", "Members", "Packages"];
  const upcoming = sessions.filter(session => openSession(sessionStatus(session, now)) && Date.parse(session.scheduledAt) >= now)
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const filtered = sessions.filter(session => {
    if (bookingFilter === "Today") return session.date === today;
    if (bookingFilter === "Upcoming") return openSession(sessionStatus(session, now)) && Date.parse(session.scheduledAt) >= now;
    if (bookingFilter !== "All") return sessionStatus(session, now) === bookingFilter.toLowerCase();
    return true;
  });
  const visible = filtered.filter(session => calendarView === "Month" || (calendarView === "Day" ? session.date === dateFilter : withinWeek(session.date, dateFilter)))
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  const calendarEvents = filtered.map(session => ({
    id: session.id, title: session.memberName, date: session.date, time: session.start.slice(0, 5),
    description: [timeLabel(session, zone), session.packageName].filter(Boolean).join(" · "), status: sessionStatus(session, now).replaceAll("_", " "),
  }));

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <TrainerPhoto name={trainer.name} photo={trainer.photo} />
        <div className="min-w-0"><p className="break-words font-semibold">{trainer.name}</p><p className="text-xs text-ink-muted">{trainer.code || "—"}</p></div>
        <TrainerStatus status={trainer.status} />
      </div>
      {canManage && <Button type="button" variant="secondary" size="sm" onClick={onEdit}>Edit Trainer</Button>}
    </div>
    <nav aria-label="Trainer detail sections" className="flex flex-wrap gap-1 border-b border-line pb-2">
      {tabs.map(section => <Button type="button" key={section} size="sm" variant="ghost" aria-pressed={tab === section} aria-controls={panelId}
        className={tab === section ? "bg-primary-tint text-primary" : ""} onClick={() => setTab(section)}>{section}</Button>)}
    </nav>
    <section id={panelId} aria-label={tab} className="space-y-4">
      {tab === "Overview" && <>
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line p-4 sm:grid-cols-3">
          <LabeledValue label="Specializations">{trainer.specializations.join(", ")}</LabeledValue>
          <LabeledValue label="Experience">{trainer.experience} years</LabeledValue>
          <LabeledValue label="Employment">{employmentLabels[trainer.employment]}</LabeledValue>
          <LabeledValue label="Session Rate">{formatCurrency(trainer.rate, "IDR")}</LabeledValue>
          <LabeledValue label="Session Duration">{trainer.duration} minutes</LabeledValue>
          <LabeledValue label="Active Members">{trainer.activeMembers}</LabeledValue>
          <LabeledValue label="Phone">{trainer.phone}</LabeledValue>
          <LabeledValue label="Email">{trainer.email}</LabeledValue>
          <LabeledValue label="Gender">{trainer.gender}</LabeledValue>
        </dl>
        <dl className="grid gap-4 rounded-lg border border-line p-4"><LabeledValue label="Biography">{trainer.bio}</LabeledValue><LabeledValue label="Certifications">{trainer.certifications}</LabeledValue></dl>
        <Card className="p-4">
          <h3 className="font-semibold">Upcoming sessions</h3>
          {upcoming.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No upcoming sessions.</p> : <>
            {trainer.status !== "active" && <p role="status" className="mt-2 rounded-lg border border-line bg-elevated p-3 text-sm">This trainer is {trainerStatusLabels[trainer.status].toLowerCase()}. Review their upcoming bookings in Schedule. Existing bookings keep their schedules.</p>}
            <ul className="mt-2 divide-y divide-line">{(trainer.status === "active" ? upcoming.slice(0, 3) : upcoming).map(session => <li key={session.id} className="py-2">{sessionSummary(session, now, zone)}</li>)}</ul>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => { setBookingFilter("Upcoming"); setCalendarView("Month"); setTab("Schedule"); }}>View schedule ({upcoming.length})</Button>
          </>}
        </Card>
      </>}
      {tab === "Schedule" && <>
        {notice && <p role="status" className="rounded-lg border border-line bg-elevated p-3 text-sm">{notice}</p>}
        <TrainerAvailability availability={trainer.availability} sessions={sessions} canManage={canManage} timezone={zone} onSave={onSaveAvailability} />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Calendar view">
          {(["Day", "Week", "Month"] as const).map(view => <Button key={view} type="button" variant={calendarView === view ? "primary" : "secondary"} size="sm" aria-pressed={calendarView === view} onClick={() => setCalendarView(view)}>{view}</Button>)}
          {calendarView !== "Month" && <Input className="max-w-44" aria-label="Calendar date" type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} />}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Booking filter">
          {(["All", "Today", "Upcoming", "Completed", "Cancelled"] as const).map(filter => <Button key={filter} type="button" variant={bookingFilter === filter ? "primary" : "ghost"} size="sm" aria-pressed={bookingFilter === filter} onClick={() => { setBookingFilter(filter); if (filter === "Today") setDateFilter(today); }}>{filter}</Button>)}
        </div>
        {calendarView === "Month" && <ScheduleCalendar key={bookingFilter === "Today" ? `today-${today}` : dateFilter} title="Booking calendar" events={calendarEvents} initialDate={dateFilter} showAgenda={false} timezone={timezone} onDateSelect={date => { if (date) { setDateFilter(date); setCalendarView("Day"); } }} />}
        <Card className="p-4">
          <h3 className="mb-2 font-semibold">{bookingFilter === "All" ? "Bookings" : `${bookingFilter} bookings`}</h3>
          {trainer.status !== "active" && upcoming.length > 0 && <p role="status" className="mb-2 rounded-lg border border-line bg-elevated p-3 text-sm">This trainer is {trainerStatusLabels[trainer.status].toLowerCase()}. Review their {upcoming.length} upcoming {upcoming.length === 1 ? "booking" : "bookings"}.</p>}
          {!visible.length ? <p className="text-sm text-ink-muted">No bookings match this view.</p> : <ul className="divide-y divide-line">
            {visible.map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              {sessionSummary(session, now, zone)}
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setViewBooking(session)}>View details</Button>
                {canEditSessions && openSession(sessionStatus(session, now)) && Date.parse(session.scheduledAt) >= now && <>
                <Button type="button" size="sm" variant="secondary" onClick={() => setSessionChange({ operation: "reschedule", session })}>Reschedule</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSessionChange({ operation: "cancel", session })}>Cancel Session</Button>
                {!demo && sessionStatus(session, now) === "pending_approval" && <>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setSessionChange({ operation: "approve", session })}>Approve</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSessionChange({ operation: "reject", session })}>Reject</Button>
                </>}
                </>}
              </div>
            </li>)}
          </ul>}
        </Card>
      </>}
      {tab === "Members" && (members.length ? <Card><ul className="divide-y divide-line">
        {members.map(member => <li key={member.id} className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <TrainerPhoto name={member.name} photo={member.photo} />
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{member.name}</p><p className="break-words text-xs text-ink-muted">{member.packageName || "Package unavailable"}</p></div>
            <Badge tone={member.status === "active" ? "success" : "neutral"}><span className="capitalize">{member.status}</span></Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3"><LabeledValue label="Remaining sessions">{member.remainingSessions}</LabeledValue><LabeledValue label="Last session">{member.lastSession ? `${dateAndTime.format(new Date(member.lastSession))} ${zone}` : "—"}</LabeledValue><LabeledValue label="Next session">{member.nextSession ? `${dateAndTime.format(new Date(member.nextSession))} ${zone}` : "—"}</LabeledValue></dl>
        </li>)}
      </ul></Card> : <EmptyState title="No assigned members" description="Assigned PT members will appear here." />)}
      {tab === "Packages" && (detail.packages?.length ? <Card><ul className="divide-y divide-line">
        {detail.packages.map(plan => <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div><p className="font-medium">{plan.name}</p><p className="text-xs text-ink-muted">{[plan.duration, plan.sessionDuration ? `${plan.sessionDuration} min per session` : undefined, plan.availability].filter(Boolean).join(" · ")}</p></div>
          <span className="num">{formatCurrency(plan.rate, "IDR")}</span>
        </li>)}
      </ul></Card> : <EmptyState title="No linked PT packages" description="Packages linked to this trainer’s active PT clients will appear here." />)}
    </section>
    {viewBooking && <TrainerDrawer title="Booking Details" centered onClose={() => setViewBooking(null)}>
      <dl className="grid grid-cols-2 gap-4">
        <LabeledValue label="Member">{viewBooking.memberName}</LabeledValue>
        <LabeledValue label="Trainer">{trainer.name}</LabeledValue>
        <LabeledValue label="Schedule">{timeLabel(viewBooking, zone)}</LabeledValue>
        <LabeledValue label="Status"><span className="capitalize">{sessionStatus(viewBooking, now).replaceAll("_", " ")}</span></LabeledValue>
        <LabeledValue label="Package">{viewBooking.packageName}</LabeledValue>
      </dl>
    </TrainerDrawer>}
    {sessionChange && <SessionChange operation={sessionChange.operation} session={sessionChange.session} trainer={trainer.name} actor={actor} demo={demo} zone={zone}
      onClose={() => setSessionChange(null)} onSave={async (date, start, end, reason) => {
        const result = await onSessionChange(sessionChange.operation, sessionChange.session.id, date, start, end, reason);
        if (!result.error) {
          setNotice(operationLabels[sessionChange.operation].notice);
          setSessionChange(null);
        }
        return result;
      }} />}
  </div>;
}
