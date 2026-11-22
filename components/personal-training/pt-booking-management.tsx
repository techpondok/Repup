"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  changePtBooking, createPtBooking, loadPtReplacementSlots, loadPtSlots, loadStaffPt, replacePtTrainer, reviewPtTrainerChange,
} from "@/app/actions/pt-bookings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { FieldError, Input, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { Card, EmptyState } from "@/components/ui/layout-bits";
import { calendarDayKey, isCalendarDate } from "@/lib/calendar";
import type { PtAssignment, PtBooking, PtBookingOperation, PtChangeRequest, PtPortal } from "@/lib/pt-bookings";

const statuses = {
  pending_approval: ["Pending Approval", "warning"],
  confirmed: ["Confirmed", "info"],
  completed: ["Completed", "success"],
  cancelled: ["Cancelled", "neutral"],
  rejected: ["Rejected", "danger"],
  expired: ["Expired", "neutral"],
  no_show: ["No Show", "warning"],
} as const;
const pageSize = 10;

type Operation = PtBookingOperation;
type Editor =
  | { kind: "browse"; bookingId: string }
  | { kind: "create" }
  | { kind: "change"; bookingId: string; operation: Operation }
  | { kind: "review"; request: PtChangeRequest }
  | { kind: "replace"; bookingId?: string };

const operationLabels: Record<Operation, string> = {
  reschedule: "Reschedule",
  cancel: "Cancel Booking",
  approve: "Approve",
  reject: "Reject",
  complete: "Mark Completed",
  no_show: "Mark No Show",
};

function normalizedStatus(status: string) {
  return status === "scheduled" ? "confirmed" : status;
}

function BookingStatus({ status }: { status: string }) {
  const entry = statuses[normalizedStatus(status) as keyof typeof statuses];
  return <Badge tone={entry?.[1] ?? "neutral"}>{entry?.[0] ?? status.replaceAll("_", " ")}</Badge>;
}

function formatTimestamp(value: string, timeZone = "Asia/Jakarta") {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? `${new Intl.DateTimeFormat("id-ID", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(parsed)} (${timeZone})`
    : value;
}

function isBookable(assignment: PtAssignment) {
  return assignment.available > 0 && assignment.trainerStatus === "active";
}

function DateAndSlot({ assignment, booking, pending, date, time, onDate, onTime }: {
  assignment?: PtAssignment;
  booking?: PtBooking;
  pending: boolean;
  date: string;
  time: string;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
}) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; slots: string[]; error?: string } | null>(null);
  const assignmentId = assignment?.id ?? booking?.assignmentId;
  const bookingId = booking?.id;
  const key = `${assignmentId}:${bookingId ?? ""}:${date}:${retry}`;
  const active = Boolean(assignmentId && isCalendarDate(date));
  useEffect(() => {
    if (!assignmentId || !isCalendarDate(date)) return;
    let current = true;
    loadPtSlots(assignmentId, date, bookingId).then(
      value => { if (current) setResult({ key, ...value }); },
      () => { if (current) setResult({ key, slots: [], error: "Could not load available times." }); },
    );
    return () => { current = false; };
  }, [assignmentId, date, bookingId, key]);
  const ready = active && result?.key === key;
  const slots = ready ? result.slots.filter(slot => booking?.date !== date || booking.start !== slot) : [];
  const error = ready && result.error;

  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block min-w-0 text-sm">{booking ? "New Date" : "Booking Date"}<Input className="mt-1" type="date" min={assignment?.earliestBookingDate} max={assignment?.latestBookingDate} required value={date} onChange={event => onDate(event.target.value)} disabled={pending || !assignmentId} /></label>
    <div className="min-w-0">
      <label className="block text-sm">Available Time Slots
        <Select className="mt-1" required value={time} onChange={event => onTime(event.target.value)} disabled={pending || !slots.length}>
          <option value="">Select time</option>
          {slots.map(slot => <option key={slot} value={slot}>{slot} ({assignment?.timezone ?? booking?.timezone ?? "WIB"})</option>)}
        </Select>
      </label>
      {active && !ready && <p role="status" className="mt-1 text-xs text-ink-muted">Loading available times…</p>}
      {ready && !error && !slots.length && <p className="mt-1 text-xs text-ink-muted">No slots available on this date.</p>}
      {error && <div className="mt-1"><p role="alert" className="text-xs text-danger">{error}</p><Button variant="ghost" size="sm" type="button" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>}
    </div>
  </div>;
}

function BookingDetails({ booking, assignment, canManage, onEdit }: {
  booking: PtBooking;
  assignment?: PtAssignment;
  canManage: boolean;
  onEdit: (editor: Editor) => void;
}) {
  const [now] = useState(() => Date.now());
  const status = booking.status === "pending_approval" && booking.approvalExpiresAt && Date.parse(booking.approvalExpiresAt) <= now
    ? "expired" : normalizedStatus(booking.status);
  const pending = status === "pending_approval";
  const confirmed = status === "confirmed";
  const started = !!booking.scheduledAt && Date.parse(booking.scheduledAt) <= now;
  const cancellation = booking.history?.find(item => item.action === "pt_session.cancelled");
  const fields = [
    ["Member", booking.memberName], ["PT Package", booking.packageName],
    ["Assigned Trainer", booking.assignedTrainerName], ["Actual Session Trainer", booking.trainerName],
    ["Booking Date", booking.date], ["Time", `${booking.start}–${booking.end}`],
    ["Duration", `${booking.duration} minutes`], ["Created By", booking.createdBy],
  ];
  if (assignment && assignment.trainerName !== booking.assignedTrainerName) fields.push(["Current Package Trainer", assignment.trainerName]);
  if (pending && booking.approvalExpiresAt) fields.push(["Approval Expires", formatTimestamp(booking.approvalExpiresAt, booking.timezone)]);
  if (cancellation) fields.push(["Cancelled By", cancellation.actorName ?? "Staff"], ["Cancellation Date", formatTimestamp(cancellation.time, booking.timezone)]);
  return <div className="space-y-5">
    <BookingStatus status={status} />
    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value || "—"}</dd></div>)}</dl>
    {booking.reason && <p className="rounded-md border border-line p-3 text-sm"><strong>Cancellation Reason</strong><br />{booking.reason}</p>}
    <section aria-label="Booking history">
      <h3 className="mb-2 text-sm font-semibold">Booking history</h3>
      {booking.history?.length ? <ul className="divide-y divide-line rounded-lg border border-line">{booking.history.map((item, index) => <li key={`${item.time}-${index}`} className="space-y-1 p-3 text-sm">
        <p className="flex flex-wrap justify-between gap-2"><strong className="capitalize">{(item.action.split(".").at(-1) ?? item.action).replaceAll("_", " ")}</strong><span className="text-xs text-ink-muted">{formatTimestamp(item.time, booking.timezone)}</span></p>
        {item.actorName && <p className="text-xs text-ink-muted">Changed by {item.actorName}</p>}
        {item.previousStart !== item.newStart && <p className="text-xs text-ink-muted">{item.previousStart ? formatTimestamp(item.previousStart, booking.timezone) : "—"} → {item.newStart ? formatTimestamp(item.newStart, booking.timezone) : "—"}</p>}
        {item.previousTrainer !== item.newTrainer && <p className="text-xs text-ink-muted">{item.previousTrainer ?? "—"} → {item.newTrainer ?? "—"}</p>}
        {item.reason && <p className="break-words text-ink-muted">{item.reason}</p>}
      </li>)}</ul> : <p className="text-sm text-ink-muted">No booking changes recorded.</p>}
    </section>
    {(pending || confirmed) && <div className="flex flex-wrap gap-2 border-t border-line pt-4">
      {pending && (["approve", "reject"] as const).map(operation => <Button key={operation} variant="secondary" size="sm" onClick={() => onEdit({ kind: "change", bookingId: booking.id, operation })}>{operationLabels[operation]}</Button>)}
      {(["reschedule", "cancel"] as const).map(operation => <Button key={operation} variant="secondary" size="sm" onClick={() => onEdit({ kind: "change", bookingId: booking.id, operation })}>{operationLabels[operation]}</Button>)}
      {confirmed && started && (["complete", "no_show"] as const).map(operation => <Button key={operation} variant="secondary" size="sm" onClick={() => onEdit({ kind: "change", bookingId: booking.id, operation })}>{operationLabels[operation]}</Button>)}
      {canManage && <Button variant="secondary" size="sm" onClick={() => onEdit({ kind: "replace", bookingId: booking.id })}>Replace Session Trainer</Button>}
    </div>}
  </div>;
}

function ReplacementHistory({ data, onBooking }: { data: PtPortal; onBooking: (id: string) => void }) {
  const rows = [
    ...(data.assignmentHistory ?? []).map(history => ({
      ...history, key: history.id, member: history.memberName, package: history.packageName,
      timezone: history.timezone, type: "Permanent", bookingId: "", reference: "",
    })),
    ...data.bookings.flatMap(booking => (booking.history ?? []).filter(history => history.action === "pt_session.trainer_replaced").map((history, index) => ({
      ...history, key: `${booking.id}:${index}`, member: booking.memberName, package: booking.packageName,
      timezone: booking.timezone, type: "Temporary", bookingId: booking.id, reference: booking.reference,
    }))),
  ].sort((left, right) => right.time.localeCompare(left.time));
  return <Card className="divide-y divide-line">
    {rows.length ? rows.map(row => <article key={row.key} className="space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{row.member} · {row.package}</strong><Badge>{row.type}</Badge></div>
      <p>{row.previousTrainer ?? "—"} → {row.newTrainer ?? "—"}</p>
      {row.reason && <p className="break-words text-ink-muted">{row.reason}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">{row.actorName ?? "Staff"} · {formatTimestamp(row.time, row.timezone)}</p>
        {row.bookingId && <Button size="sm" variant="ghost" onClick={() => onBooking(row.bookingId)}>{row.reference}</Button>}
      </div>
    </article>) : <EmptyState title="No trainer replacements recorded" description="Permanent and temporary trainer changes will appear here." />}
  </Card>;
}

function ReplacementAvailability({ assignmentId, trainerId, booking, suggestedDate }: {
  assignmentId: string;
  trainerId: string;
  booking?: PtBooking;
  suggestedDate?: string;
}) {
  const [date, setDate] = useState(booking?.date ?? suggestedDate ?? "");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; slots: string[]; error?: string } | null>(null);
  const key = `${assignmentId}:${trainerId}:${booking?.id ?? ""}:${date}:${retry}`;
  const sessionId = booking?.id;
  useEffect(() => {
    if (!isCalendarDate(date)) return;
    let current = true;
    loadPtReplacementSlots(assignmentId, trainerId, date, sessionId).then(
      value => { if (current) setResult({ key, ...value }); },
      () => { if (current) setResult({ key, slots: [], error: "Could not check trainer availability." }); },
    );
    return () => { current = false; };
  }, [assignmentId, date, key, sessionId, trainerId]);

  const preview = result?.key === key ? result : null;
  return <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
    <h3 className="font-medium">Replacement trainer availability</h3>
    {!booking && <label className="block">Check a date<Input className="mt-1" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>}
    {isCalendarDate(date) && !preview && <p role="status" className="text-xs text-ink-muted">Checking available times…</p>}
    {preview?.error && <div><p role="alert" className="text-xs text-danger">{preview.error}</p><Button variant="ghost" size="sm" type="button" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>}
    {preview && !preview.error && (booking ? <p className="text-xs text-ink-muted">{preview.slots.includes(booking.start) ? "The trainer is available at the current session time." : "The current session time is unavailable for this trainer."}</p>
      : <p className="text-xs text-ink-muted">{preview.slots.length ? preview.slots.join(", ") : "No slots available on this date."}</p>)}
  </div>;
}

function BookingEditor({ editor, data, onClose, onSaved, onEdit }: {
  editor: Editor;
  data: PtPortal;
  onClose: () => void;
  onSaved: (notice: string) => void;
  onEdit: (editor: Editor) => void;
}) {
  const booking = "bookingId" in editor ? data.bookings.find(item => item.id === editor.bookingId) : undefined;
  const [assignmentId, setAssignmentId] = useState(booking?.assignmentId ?? (editor.kind === "review" ? editor.request.assignmentId : ""));
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [trainerId, setTrainerId] = useState(editor.kind === "review" && editor.request.preferredTrainerId && data.trainers.some(trainer => trainer.id === editor.request.preferredTrainerId)
    ? editor.request.preferredTrainerId : "");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const close = useCallback(() => { if (!pending) onClose(); }, [onClose, pending]);
  const assignment = data.assignments.find(item => item.id === assignmentId);
  const needsSlot = editor.kind === "create" || (editor.kind === "change" && editor.operation === "reschedule");
  const needsTrainer = editor.kind === "replace" || (editor.kind === "review" && decision === "approved");
  const requiresReason = editor.kind === "replace" || (editor.kind === "review" && decision === "approved") || (editor.kind === "change" && ["reschedule", "cancel", "reject"].includes(editor.operation));
  const showsReason = requiresReason || editor.kind === "review";
  const needsAssignment = editor.kind === "create" || (editor.kind === "replace" && !booking);
  const title = editor.kind === "create" ? "New PT Booking"
    : editor.kind === "browse" ? booking?.reference ?? "Booking Detail"
    : editor.kind === "change" ? operationLabels[editor.operation]
    : editor.kind === "review" ? "Review Trainer Change"
    : booking ? "Replace Session Trainer" : "Replace Assigned Trainer";
  const excludedTrainer = booking?.trainerId ?? assignment?.trainerId;
  const trainers = data.trainers.filter(trainer => trainer.id !== excludedTrainer);
  const submitBlocked = pending || (needsSlot && !time) || (needsTrainer && !trainerId) || (needsAssignment && !assignmentId);
  const [now] = useState(() => Date.now());
  const today = calendarDayKey(new Date(now));
  const showsAffected = !!assignmentId && ((editor.kind === "review" && decision === "approved") || (editor.kind === "replace" && !booking));
  const affected = showsAffected ? data.bookings.filter(item => item.assignmentId === assignmentId
    && (item.scheduledAt ? Date.parse(item.scheduledAt) >= now : item.date >= today)
    && ["confirmed", "pending_approval"].includes(normalizedStatus(item.status)))
    .sort((left, right) => `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`)) : [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitBlocked) return;
    if (requiresReason && !reason.trim()) {
      setError("Enter a reason to continue.");
      return;
    }
    setPending(true);
    setError("");
    try {
      let result: { error?: string };
      let notice: string;
      if (editor.kind === "create") {
        result = await createPtBooking(assignmentId, date, time);
        notice = "PT booking created.";
      } else if (editor.kind === "change" && booking) {
        result = await changePtBooking(booking.id, editor.operation, date || undefined, time || undefined, reason.trim() || undefined);
        notice = "Booking updated.";
      } else if (editor.kind === "review") {
        result = await reviewPtTrainerChange(editor.request.id, decision, decision === "approved" ? trainerId : "", reason.trim());
        notice = decision === "approved" ? "Trainer change approved." : "Trainer change rejected.";
      } else if (editor.kind === "replace") {
        result = await replacePtTrainer(assignmentId, booking?.id ?? null, trainerId, reason.trim());
        notice = booking ? "Session trainer replaced." : "Assigned trainer replaced.";
      } else return;
      if (result.error) setError(result.error);
      else onSaved(notice);
    } catch {
      setError("Could not save changes. Try again.");
    } finally {
      setPending(false);
    }
  }

  return <FormModal open title={title} trigger={null} size="medium" onClose={close}>
    {editor.kind === "browse" ? booking ? <BookingDetails booking={booking} assignment={assignment} canManage={!!data.canManage} onEdit={onEdit} /> : <EmptyState title="Booking unavailable" /> :
      <form onSubmit={submit} className="space-y-4">
        {booking && <Card className="space-y-1 p-3 text-sm"><p className="font-medium">{booking.memberName} · {booking.reference}</p><p className="text-ink-muted">Current schedule {booking.date}, {booking.start}–{booking.end} · {booking.trainerName}</p></Card>}
        {editor.kind === "review" && <Card className="space-y-1 p-3 text-sm"><p className="font-medium">{assignment?.memberName ?? editor.request.memberName ?? "Member"} · {assignment?.packageName ?? editor.request.packageName ?? "PT Package"}</p><p>Current trainer {editor.request.trainerName}</p><p className="text-ink-muted">{editor.request.reason}{editor.request.notes ? ` · ${editor.request.notes}` : ""}</p>{editor.request.preferredTrainerName && <p>Preferred trainer {editor.request.preferredTrainerName}</p>}</Card>}
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          {needsAssignment && <label className="block text-sm">Member and PT Package
            <Select className="mt-1" required value={assignmentId} onChange={event => { setAssignmentId(event.target.value); setTime(""); setTrainerId(""); }}><option value="">Select assignment</option>
              {data.assignments.filter(item => editor.kind !== "create" || isBookable(item)).map(item => <option key={item.id} value={item.id}>{item.memberName} · {item.packageName}</option>)}
            </Select>
          </label>}
          {assignment && editor.kind === "create" && <p className="text-sm text-ink-muted">Assigned trainer {assignment.trainerName} · {assignment.duration} min · {assignment.available} sessions available</p>}
          {needsSlot && <DateAndSlot assignment={assignment} booking={booking} pending={pending} date={date} time={time} onDate={value => { setDate(value); setTime(""); }} onTime={setTime} />}
          {editor.kind === "review" && <label className="block text-sm">Decision<Select className="mt-1" value={decision} onChange={event => setDecision(event.target.value === "rejected" ? "rejected" : "approved")}><option value="approved">Approve</option><option value="rejected">Reject</option></Select></label>}
          {needsTrainer && <label className="block text-sm">New Trainer
            <Select className="mt-1" required value={trainerId} onChange={event => setTrainerId(event.target.value)}>
              <option value="">Select trainer</option>
              {trainers.map(trainer => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}
            </Select>
          </label>}
          {editor.kind === "replace" && <p className="text-sm text-ink-muted">{booking ? "Only this booking will use the replacement trainer." : "This changes the package’s assigned trainer. Existing bookings retain their session trainer."}</p>}
          {needsTrainer && assignmentId && trainerId && <ReplacementAvailability key={`${assignmentId}:${trainerId}`} assignmentId={assignmentId} trainerId={trainerId} booking={booking} suggestedDate={affected[0]?.date} />}
          {showsAffected && <section aria-label="Affected bookings" className="space-y-2 rounded-lg border border-line p-3 text-sm">
            <h3 className="font-medium">Upcoming bookings to review</h3>
            {affected.length ? <>
              <p className="text-xs text-ink-muted">These bookings retain their session trainer. Review each booking for rescheduling or reassignment.</p>
              <ul className="max-h-40 divide-y divide-line overflow-y-auto">{affected.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{item.reference} · {item.date}, {item.start} · {item.trainerName}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => onEdit({ kind: "browse", bookingId: item.id })}>View Booking</Button>
              </li>)}</ul>
            </> : <p className="text-xs text-ink-muted">No upcoming bookings for this assignment.</p>}
          </section>}
          {showsReason && <label className="block text-sm">{editor.kind === "change" && editor.operation === "cancel" ? "Cancellation Reason" : editor.kind === "change" && editor.operation === "reschedule" ? "Reschedule Reason" : requiresReason ? "Reason" : "Reason (optional)"}
            <Textarea className="mt-1" rows={3} maxLength={300} value={reason} required={requiresReason} onChange={event => setReason(event.target.value)} />
          </label>}
        </fieldset>
        {error && <div role="alert"><FieldError>{error}</FieldError></div>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="secondary" disabled={pending} onClick={booking ? () => onEdit({ kind: "browse", bookingId: booking.id }) : close}>Back</Button>
          <Button type="submit" disabled={submitBlocked} aria-busy={pending} variant={(editor.kind === "change" && ["cancel", "reject", "no_show"].includes(editor.operation)) || (editor.kind === "review" && decision === "rejected") ? "danger" : "primary"}>{pending ? "Saving…" : title}</Button>
        </div>
      </form>}
  </FormModal>;
}

export function PtBookingManagement({ initialData, demo = false }: { initialData: PtPortal; demo?: boolean }) {
  const [data, setData] = useState(initialData);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [section, setSection] = useState<"bookings" | "requests" | "history">("bookings");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [trainer, setTrainer] = useState("");
  const [member, setMember] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "member">("newest");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(initialData.error ?? "");
  const [loading, setLoading] = useState(false);
  const close = useCallback(() => setEditor(null), []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await loadStaffPt();
      if (result.error) setError(result.error);
      else setData(result);
    } catch {
      setError("Could not refresh PT bookings. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function saved(message: string) {
    setEditor(null);
    setNotice(message);
    void refresh();
  }

  const trainers = [...new Set(data.bookings.flatMap(item => [item.trainerName, item.assignedTrainerName]).filter(Boolean))].sort();
  const members = [...new Set(data.bookings.map(item => item.memberName))].sort();
  const search = query.trim().toLowerCase();
  const matches = data.bookings.filter(item =>
    (!search || [item.reference, item.memberName, item.trainerName, item.assignedTrainerName, item.packageName].join(" ").toLowerCase().includes(search))
    && (!date || item.date === date)
    && (!trainer || item.trainerName === trainer || item.assignedTrainerName === trainer)
    && (!member || item.memberName === member)
    && (!status || normalizedStatus(item.status) === status)).sort((left, right) => {
    const byDate = `${left.date} ${left.start}`.localeCompare(`${right.date} ${right.start}`);
    if (sort === "member") return left.memberName.localeCompare(right.memberName) || -byDate;
    return sort === "oldest" ? byDate : -byDate;
  });
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pages);
  const rows = matches.slice((current - 1) * pageSize, current * pageSize);
  const open = (bookingId: string) => setEditor({ kind: "browse", bookingId });
  const selectedEditorKey = editor ? JSON.stringify(editor) : "";

  if (demo) return <Card><EmptyState title="PT Bookings" description="Live booking management is available in a connected gym workspace." /></Card>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="PT booking sections" className="flex flex-wrap gap-1">
        <Button size="sm" variant={section === "bookings" ? "primary" : "ghost"} onClick={() => setSection("bookings")} aria-pressed={section === "bookings"}>Bookings</Button>
        {data.canManage && <Button size="sm" variant={section === "requests" ? "primary" : "ghost"} onClick={() => setSection("requests")} aria-pressed={section === "requests"}>Trainer Change Requests</Button>}
        {data.canManage && <Button size="sm" variant={section === "history" ? "primary" : "ghost"} onClick={() => setSection("history")} aria-pressed={section === "history"}>Replacement History</Button>}
      </nav>
      <div className="flex flex-wrap gap-2">
        {data.canManage && <Button size="sm" variant="secondary" disabled={loading || !!error || !data.assignments.length} onClick={() => setEditor({ kind: "replace" })}>Replace Assigned Trainer</Button>}
        <Button size="sm" disabled={loading || !!error || !data.assignments.some(isBookable)} onClick={() => setEditor({ kind: "create" })}>New PT Booking</Button>
      </div>
    </div>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {loading && <p role="status" className="text-sm text-ink-muted">Loading PT bookings…</p>}
    {error && <Card className="flex flex-wrap items-center justify-between gap-3 p-4"><p role="alert" className="text-sm text-danger">{error}</p><Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void refresh()}>Retry</Button></Card>}
    {section === "bookings" && (!error || data.bookings.length > 0) && <>
      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <label className="block min-w-0 text-sm">Search<Input className="mt-1" type="search" placeholder="Reference or name" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        <label className="block min-w-0 text-sm">Booking Date<Input className="mt-1" type="date" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} /></label>
        <label className="block min-w-0 text-sm">Trainer<Select className="mt-1" value={trainer} onChange={event => { setTrainer(event.target.value); setPage(1); }}><option value="">All trainers</option>{trainers.map(name => <option key={name}>{name}</option>)}</Select></label>
        <label className="block min-w-0 text-sm">Member<Select className="mt-1" value={member} onChange={event => { setMember(event.target.value); setPage(1); }}><option value="">All members</option>{members.map(name => <option key={name}>{name}</option>)}</Select></label>
        <label className="block min-w-0 text-sm">Status<Select className="mt-1" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{Object.entries(statuses).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</Select></label>
        <label className="block min-w-0 text-sm">Sort by<Select className="mt-1" value={sort} onChange={event => { setSort(event.target.value === "oldest" ? "oldest" : event.target.value === "member" ? "member" : "newest"); setPage(1); }}><option value="newest">Latest session first</option><option value="oldest">Earliest session first</option><option value="member">Member name</option></Select></label>
      </Card>
      <Card>
        {rows.length ? <>
          <div className="hidden md:block"><DataTable className="min-w-[70rem]">
            <thead><tr className="border-b border-line text-left text-xs text-ink-muted">
              {["Booking Reference", "Member", "Assigned Trainer", "Actual Session Trainer", "PT Package", "Booking Date", "Start Time", "End Time", "Status", "Created By", "Action"].map(label => <th scope="col" key={label} className="px-3 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{rows.map(booking => <tr key={booking.id} className="border-b border-line last:border-0">
              <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-medium">{booking.reference}</th>
              <td className="px-3 py-3">{booking.memberName}</td><td className="px-3 py-3">{booking.assignedTrainerName}</td><td className="px-3 py-3">{booking.trainerName}</td><td className="px-3 py-3">{booking.packageName}</td>
              <td className="whitespace-nowrap px-3 py-3">{booking.date}</td><td className="px-3 py-3">{booking.start}</td><td className="px-3 py-3">{booking.end}</td><td className="px-3 py-3"><BookingStatus status={booking.status} /></td><td className="px-3 py-3">{booking.createdBy}</td>
              <td className="px-3 py-3"><Button size="sm" variant="secondary" onClick={() => open(booking.id)}>View Detail</Button></td>
            </tr>)}</tbody>
          </DataTable></div>
          <ul className="divide-y divide-line md:hidden">{rows.map(booking => <li key={booking.id} className="space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{booking.reference}</strong><BookingStatus status={booking.status} /></div>
            <p>{booking.memberName} · {booking.packageName}</p>
            <p className="text-ink-muted">Assigned {booking.assignedTrainerName} · Session {booking.trainerName}</p>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-ink-muted">{booking.date} · {booking.start}–{booking.end}</p><Button size="sm" variant="secondary" onClick={() => open(booking.id)}>View Detail</Button></div>
          </li>)}</ul>
        </> : !loading && <EmptyState title={data.bookings.length ? "No matching bookings" : "No PT bookings yet"} description={data.bookings.length ? "Try another search or filter." : "Bookings for visible PT client assignments will appear here."} />}
        {pages > 1 && <nav aria-label="PT booking pages" className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-3 text-sm"><Button size="sm" variant="secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button><span>Page {current} of {pages}</span><Button size="sm" variant="secondary" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button></nav>}
      </Card>
    </>}
    {section === "requests" && data.canManage && <Card className="divide-y divide-line">
      {data.requests.length ? data.requests.map(request => {
        const item = data.assignments.find(row => row.id === request.assignmentId);
        const reviewable = ["pending", "under_review"].includes(request.status);
        return <article key={request.id} className="space-y-2 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{item?.memberName ?? request.memberName ?? "Member"} · {item?.packageName ?? request.packageName ?? "PT Package"}</strong><Badge tone={request.status === "approved" ? "success" : request.status === "rejected" ? "danger" : "warning"}><span className="capitalize">{request.status.replaceAll("_", " ")}</span></Badge></div>
          <p className="text-ink-muted">Current {request.trainerName}{request.preferredTrainerName ? ` · Preferred ${request.preferredTrainerName}` : ""}</p>
          <p className="break-words">{request.reason}{request.notes ? ` · ${request.notes}` : ""}</p>
          {request.reviewReason && <p className="break-words text-xs text-ink-muted">Review reason {request.reviewReason}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-ink-muted">{formatTimestamp(request.createdAt, item?.timezone)}</span>{reviewable && <Button size="sm" variant="secondary" disabled={loading} onClick={() => setEditor({ kind: "review", request })}>Review Request</Button>}</div>
        </article>;
      }) : !loading && <EmptyState title="No trainer change requests" description="Member requests will appear here for review." />}
    </Card>}
    {section === "history" && data.canManage && <ReplacementHistory data={data} onBooking={open} />}
    {editor && <BookingEditor key={selectedEditorKey} editor={editor} data={data} onClose={close} onSaved={saved} onEdit={setEditor} />}
  </div>;
}
