"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPtTrainerChange } from "@/app/actions/pt-bookings";
import { FormModal } from "@/components/ui/form-modal";
import type { PtAssignment, PtPortal } from "@/lib/pt-bookings";
import { EmptyState, PTStatusBadge } from "./pt-ui";
import { gymDate, LivePtBookingCard, LivePtError, LivePtHeader, openPtBooking, PtAssignmentTrainer, PtPackageSummary, ptDisplayTimestamp, ptStatusLabel } from "./pt-live-shared";

export function LivePtOverview({ portal, packages = false }: { portal: PtPortal; packages?: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [success, setSuccess] = useState("");
  const closeRequest = useCallback(() => { if (!submitting) setRequestOpen(false); }, [submitting]);
  const assignment = portal.assignments.find(item => item.id === picked)
    ?? portal.assignments.find(item => (!item.expiresOn || item.expiresOn >= gymDate(item.timezone)))
    ?? portal.assignments[0];
  const today = assignment ? gymDate(assignment.timezone) : "";
  const bookings = portal.bookings.filter(item => item.assignmentId === assignment?.id && openPtBooking(item.status)
    && item.date >= today).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const requests = portal.requests.filter(item => item.assignmentId === assignment?.id);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !assignment) return;
    const data = new FormData(event.currentTarget);
    setRequestError("");
    setSubmitting(true);
    try {
      const result = await requestPtTrainerChange(assignment.id, String(data.get("reason") || ""), String(data.get("trainer") || ""), String(data.get("notes") || "").trim());
      if (result.error) setRequestError(result.error);
      else {
        setRequestOpen(false);
        setSuccess("Trainer change request submitted.");
        router.refresh();
      }
    } catch {
      setRequestError("Could not submit the request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const bookable = assignment && assignment.available > 0 && assignment.trainerId && assignment.trainerStatus === "active"
    && (!assignment.expiresOn || assignment.expiresOn >= today);
  return <div className="space-y-6">
    <LivePtHeader title={packages ? "My PT packages" : "My Personal Training"} description={packages ? "Review your training packages, credits, and assigned trainers." : "Manage your training package, assigned trainer, and upcoming sessions."} />
    {portal.error ? <LivePtError message={portal.error} /> : !assignment ? <EmptyState title="You don't have an active personal training package yet."
      description="Contact your gym to ask about personal training packages." /> : packages ? <div className="grid gap-4 lg:grid-cols-2">
        {portal.assignments.map(item => <div key={item.id} className="space-y-3">
          <PtPackageSummary assignment={item} />
          <div className="mp-card"><PtAssignmentTrainer assignment={item} /></div>
        </div>)}
      </div> : <>
      {portal.assignments.length > 1 && <label className="mp-card block text-sm">PT Package<select className="mp-field mt-2 max-w-sm" value={assignment.id} onChange={event => { setPicked(event.target.value); setSuccess(""); }}>
        {portal.assignments.map(item => <option key={item.id} value={item.id}>{item.packageName} · {item.trainerName}</option>)}
      </select></label>}
      <div className="grid gap-4 lg:grid-cols-2">
        <PtPackageSummary assignment={assignment} />
        <section className="mp-card space-y-4">
          <h2>Assigned Trainer</h2><PtAssignmentTrainer assignment={assignment} />
          <div className="flex flex-wrap gap-2">
            {bookable ? <Link className="mp-button" href={`/member/pt/booking?assignment=${assignment.id}`}>Book Session</Link>
              : <button className="mp-button" type="button" disabled>Book Session</button>}
            <Link className="mp-button secondary" href="/member/pt/sessions">View Schedule</Link>
            {assignment.trainerId && <button type="button" className="mp-button secondary" disabled={requests.some(item => item.status === "pending")} onClick={() => { setRequestError(""); setSuccess(""); setRequestOpen(true); }}>Request Change Trainer</button>}
          </div>
          {!bookable && <p className="mp-muted text-sm">Booking requires an active trainer and an available session credit.</p>}
        </section>
      </div>
      <section className="space-y-3">
        <div className="mp-section-title"><h2>Upcoming Sessions</h2><Link className="mp-button secondary" href="/member/pt/sessions">View all</Link></div>
        {bookings.length ? <div className="grid gap-4 lg:grid-cols-2">{bookings.slice(0, 4).map(booking => <LivePtBookingCard key={booking.id} booking={booking} />)}</div>
          : <EmptyState title="No upcoming PT sessions" description="Your booked sessions will appear here." />}
      </section>
      {success && <p role="status" className="mp-card">{success}</p>}
      {requests.length > 0 && <section className="mp-card space-y-3"><h2>Trainer change requests</h2>
        <ul className="divide-y divide-line">{requests.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-3 py-3">
          <div><p className="font-medium">{item.reason}</p><p className="mp-muted text-xs">{ptDisplayTimestamp(item.createdAt, assignment.timezone)}{item.preferredTrainerName ? ` · Preferred trainer: ${item.preferredTrainerName}` : ""}</p>{item.notes && <p className="mp-muted mt-1 text-sm">{item.notes}</p>}</div>
          <PTStatusBadge>{ptStatusLabel(item.status)}</PTStatusBadge>
          {item.reviewReason && <p className="mp-muted basis-full text-sm">{item.reviewReason}</p>}
        </li>)}</ul>
      </section>}
      {!!assignment.assignmentHistory?.length && <section className="mp-card space-y-3"><h2>Assigned trainer history</h2>
        <ul className="divide-y divide-line">{assignment.assignmentHistory.map((change, index) => <li key={`${change.time}-${index}`} className="space-y-1 py-3">
          <p className="text-sm font-medium">{change.previousTrainer || "—"} → {change.newTrainer || "—"}</p>
          <p className="mp-muted text-xs">{ptDisplayTimestamp(change.time, assignment.timezone)}{change.actorName ? ` · ${change.actorName}` : ""}</p>
          {change.reason && <p className="mp-muted text-sm">{change.reason}</p>}
        </li>)}</ul>
      </section>}
      <FormModal open={requestOpen} title="Request Change Trainer" trigger={null} onClose={closeRequest}>
        <TrainerRequestForm assignment={assignment} trainers={portal.trainers} submitting={submitting} error={requestError} onClose={closeRequest} onSubmit={submitRequest} />
      </FormModal>
    </>}
  </div>;
}

function TrainerRequestForm({ assignment, trainers, submitting, error, onClose, onSubmit }: {
  assignment: PtAssignment; trainers: PtPortal["trainers"]; submitting: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <form className="space-y-4" onSubmit={onSubmit}>
    <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="mp-muted">Current trainer</dt><dd>{assignment.trainerName}</dd></div><div><dt className="mp-muted">PT package</dt><dd>{assignment.packageName}</dd></div></dl>
    <fieldset className="min-w-0 space-y-4" disabled={submitting}>
      <label className="block text-sm">Reason for Change<select name="reason" className="mp-field mt-1" required defaultValue="">
        <option value="" disabled>Select a reason</option>{["Schedule Conflict", "Trainer Unavailable", "Personal Preference", "Other"].map(reason => <option key={reason}>{reason}</option>)}
      </select></label>
      <label className="block text-sm">Preferred Trainer (optional)<select name="trainer" className="mp-field mt-1" defaultValue="">
        <option value="">No preference</option>{trainers.filter(item => item.id !== assignment.trainerId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label className="block text-sm">Additional Notes (optional)<textarea className="mp-field mt-1" name="notes" rows={3} maxLength={500} /></label>
    </fieldset>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="mp-button secondary" disabled={submitting} onClick={onClose}>Back</button><button className="mp-button" disabled={submitting} type="submit">{submitting ? "Submitting…" : "Submit Request"}</button></div>
  </form>;
}
