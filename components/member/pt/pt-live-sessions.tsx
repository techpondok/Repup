"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changePtBooking } from "@/app/actions/pt-bookings";
import { FormModal } from "@/components/ui/form-modal";
import { ScheduleCalendar } from "@/components/ui/schedule-calendar";
import type { PtBooking, PtPortal } from "@/lib/pt-bookings";
import { EmptyState, PTStatusBadge } from "./pt-ui";
import { gymDate, LivePtBookingCard, LivePtError, LivePtHeader, openPtBooking, ptDisplayDate, ptDisplayTimestamp, ptStatusLabel } from "./pt-live-shared";

const filters = [["upcoming", "Upcoming"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["no_show", "No Show"], ["rejected", "Rejected"], ["expired", "Expired"], ["all", "All"]] as const;
type SessionFilter = (typeof filters)[number][0];

function matches(booking: PtBooking, filter: SessionFilter) {
  if (filter === "all") return true;
  if (filter === "upcoming") return openPtBooking(booking.status);
  return booking.status.replaceAll("-", "_") === filter;
}

export function LivePtSessions({ portal }: { portal: PtPortal }) {
  const [filter, setFilter] = useState<SessionFilter>("upcoming");
  const [page, setPage] = useState(1);
  const filtered = portal.bookings.filter(item => matches(item, filter)).sort((a, b) => {
    const order = `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`);
    return filter === "upcoming" ? order : -order;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);

  return <div className="space-y-6">
    <LivePtHeader title="My PT Sessions" description="View your booking calendar, manage upcoming sessions, and review your training history." />
    {portal.error ? <LivePtError message={portal.error} /> : <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Session status">
        {filters.map(([value, label]) => <button type="button" aria-pressed={value === filter} className={`mp-button ${value === filter ? "" : "secondary"}`}
          key={value} onClick={() => { setFilter(value); setPage(1); }}>{label} <span>{portal.bookings.filter(item => matches(item, value)).length}</span></button>)}
      </div>
      <ScheduleCalendar title="My PT calendar" initialDate={filtered[0]?.date} events={filtered.map(item => ({
        id: item.id, title: item.trainerName, date: item.date, time: item.start,
        description: `${item.packageName} · ${item.duration} minutes`, status: ptStatusLabel(item.status),
        href: `/member/pt/sessions/${item.id}`,
      }))} />
      {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map(item => <LivePtBookingCard key={item.id} booking={item} />)}</div>
        : <EmptyState title="No PT bookings match this view" description="Select a different booking status or return to My Personal Training.">
          <Link className="mp-button secondary" href="/member/pt">My Personal Training</Link></EmptyState>}
      {pages > 1 && <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Booking pages">
        <button type="button" className="mp-button secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span className="text-sm">Page {currentPage} of {pages}</span>
        <button type="button" className="mp-button secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button>
      </nav>}
    </>}
  </div>;
}

export function LivePtSessionDetail({ portal, id }: { portal: PtPortal; id: string }) {
  const router = useRouter();
  const booking = portal.bookings.find(item => item.id === id);
  const assignment = portal.assignments.find(item => item.id === booking?.assignmentId);
  const timezone = booking?.timezone ?? assignment?.timezone ?? "Asia/Jakarta";
  const [now] = useState(() => Date.now());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const close = useCallback(() => { if (!pending) setCancelOpen(false); }, [pending]);
  const canChange = booking && openPtBooking(booking.status)
    && (booking.scheduledAt ? Date.parse(booking.scheduledAt) > now : booking.date >= gymDate(timezone));

  async function cancelBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!booking || pending) return;
    const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
    if (!reason) { setError("Enter a cancellation reason."); return; }
    setPending(true);
    setError("");
    try {
      const result = await changePtBooking(booking.id, "cancel", undefined, undefined, reason);
      if (result.error) setError(result.error);
      else {
        setCancelOpen(false);
        setNotice("Booking cancelled.");
        router.refresh();
      }
    } catch {
      setError("Could not cancel the booking. Try again.");
    } finally {
      setPending(false);
    }
  }

  return <div className="space-y-6">
    <LivePtHeader title="PT Booking Detail" description="Check the booking status, trainer, and schedule." />
    {portal.error ? <LivePtError message={portal.error} /> : !booking ? <EmptyState title="Booking unavailable" description="This booking is unavailable in your session history.">
      <Link className="mp-button secondary" href="/member/pt/sessions">My sessions</Link></EmptyState> : <>
      {notice && <p role="status" className="mp-card">{notice}</p>}
      <section className="mp-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2>{booking.packageName}</h2><p className="mp-muted mt-1">{booking.reference}</p></div>
          <PTStatusBadge>{ptStatusLabel(booking.status)}</PTStatusBadge></div>
        <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm md:grid-cols-3">
          {[["Member", booking.memberName], ["Assigned trainer at booking", booking.assignedTrainerName], ["Session trainer", booking.trainerName],
            ["Date", ptDisplayDate(booking.date)], ["Time", `${booking.start}–${booking.end}`], ["Duration", `${booking.duration} minutes`],
            ["Created by", booking.createdBy], ["Timezone", timezone]].map(([label, value]) => <div key={label}><dt className="mp-muted">{label}</dt><dd className="mt-1 break-words">{value || "—"}</dd></div>)}
        </dl>
        {booking.status === "pending_approval" && booking.approvalExpiresAt && <p className="mp-muted text-sm">Approval expires {ptDisplayTimestamp(booking.approvalExpiresAt, timezone)}.</p>}
        {booking.reason && <p className="text-sm"><strong>Reason</strong> · {booking.reason}</p>}
        {canChange && <div className="flex flex-wrap gap-2">
          <Link className="mp-button secondary" href={`/member/pt/booking?session=${booking.id}`}>Reschedule</Link>
          <button type="button" className="mp-button secondary" onClick={() => { setError(""); setCancelOpen(true); }}>Cancel Booking</button>
        </div>}
      </section>
      {booking.history && booking.history.length > 0 && <section className="mp-card space-y-3"><h2>Booking history</h2>
        <ul className="divide-y divide-line">{booking.history.map((entry, index) => <li key={`${entry.time}-${index}`} className="space-y-1 py-3">
          <p className="text-sm font-medium">{ptStatusLabel(entry.action.replace(/^pt_session\./, ""))}</p><p className="mp-muted text-xs">{ptDisplayTimestamp(entry.time, timezone)}{entry.actorName ? ` · ${entry.actorName}` : ""}</p>
          {entry.reason && <p className="text-sm">{entry.reason}</p>}
          {(entry.previousStart || entry.newStart) && <p className="mp-muted text-xs">{entry.previousStart ? ptDisplayTimestamp(entry.previousStart, timezone) : "—"} → {entry.newStart ? ptDisplayTimestamp(entry.newStart, timezone) : "—"}</p>}
          {(entry.previousTrainer || entry.newTrainer) && <p className="mp-muted text-xs">{entry.previousTrainer || "—"} → {entry.newTrainer || "—"}</p>}
        </li>)}</ul>
      </section>}
      <FormModal open={cancelOpen} title="Cancel Booking" trigger={null} onClose={close}>
        <form onSubmit={cancelBooking} className="space-y-4">
          <p className="text-sm">{booking.trainerName} · {ptDisplayDate(booking.date)} · {booking.start}–{booking.end}</p>
          <p className="mp-muted text-sm">Cancelled by {booking.memberName} · {ptDisplayDate(gymDate(timezone))}. Your gym’s cancellation policy determines how the session credit is handled.</p>
          <label className="block text-sm">Cancellation Reason<textarea className="mp-field mt-1" rows={3} name="reason" maxLength={300} required disabled={pending} /></label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2"><button type="button" className="mp-button secondary" disabled={pending} onClick={close}>Back</button>
            <button type="submit" className="mp-button" disabled={pending}>{pending ? "Cancelling…" : "Confirm Cancellation"}</button></div>
        </form>
      </FormModal>
    </>}
  </div>;
}
