"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { changePtBooking, createPtBooking, loadPtSlotDates, loadPtSlots } from "@/app/actions/pt-bookings";
import { FormModal } from "@/components/ui/form-modal";
import { isCalendarDate } from "@/lib/calendar";
import type { PtAssignment, PtPortal } from "@/lib/pt-bookings";
import { EmptyState } from "./pt-ui";
import { gymDate, LivePtError, LivePtHeader, openPtBooking, PtAssignmentTrainer, ptDisplayDate, ptEndTime } from "./pt-live-shared";

function firstBookable(assignments: PtAssignment[]) {
  return assignments.find(item => item.available > 0 && item.trainerId && item.trainerStatus === "active"
    && (!item.expiresOn || item.expiresOn >= gymDate(item.timezone))) ?? assignments[0];
}

function ptWeekStart(date: string) {
  if (!isCalendarDate(date)) return "";
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

function PtWeekOptions({ date, earliest, latest, assignmentId, bookingId, ready, onSelect }: {
  date: string; earliest: string; latest?: string; assignmentId: string; bookingId?: string; ready: boolean; onSelect: (date: string) => void;
}) {
  const [preview, setPreview] = useState<{ key: string; available: string[]; unknown: string[] } | null>(null);
  const week = ptWeekStart(date);
  const dates = week ? Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(`${week}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    return day.toISOString().slice(0, 10);
  }) : [];
  const range = dates.filter(day => day >= earliest && (!latest || day <= latest)).join(",");
  const key = `${assignmentId}:${bookingId ?? ""}:${range}`;
  const loaded = preview?.key === key;
  useEffect(() => {
    if (!range || !ready || loaded) return;
    let current = true;
    const days = range.split(",");
    loadPtSlotDates(assignmentId, days, bookingId).then(
      result => { if (current) setPreview({ key, available: result.dates, unknown: result.error ? days : [] }); },
      () => { if (current) setPreview({ key, available: [], unknown: days }); },
    );
    return () => { current = false; };
  }, [range, assignmentId, bookingId, key, ready, loaded]);
  const result = preview?.key === key ? preview : null;
  if (!dates.length) return null;
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });
  return <div className="space-y-2">
    <p className="text-sm">Availability this week</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Weekly date availability">
      {dates.map(day => {
        const inRange = day >= earliest && (!latest || day <= latest);
        const hasSlots = result?.available.includes(day);
        const unknown = result?.unknown.includes(day);
        const label = !inRange ? "Outside window" : !result ? "Checking" : unknown ? "Select to check" : hasSlots ? "Available" : "No slots";
        return <button type="button" className={`mp-button flex-col gap-0 px-2 text-sm ${day === date ? "" : "secondary"}`} key={day}
          aria-pressed={day === date} aria-label={`${ptDisplayDate(day)}, ${label}`}
          disabled={!inRange || (!!result && !hasSlots && !unknown && day !== date)} onClick={() => onSelect(day)}>
          <span>{weekday.format(new Date(`${day}T12:00:00Z`))}</span><span className="text-xs">{label}</span>
        </button>;
      })}
    </div>
  </div>;
}

export function LivePtBooking({ portal, assignmentId, sessionId }: { portal: PtPortal; assignmentId?: string; sessionId?: string }) {
  const router = useRouter();
  const booking = portal.bookings.find(item => item.id === sessionId);
  const [picked, setPicked] = useState(booking?.assignmentId ?? assignmentId ?? "");
  const assignment = booking ? portal.assignments.find(item => item.id === booking.assignmentId)
    : portal.assignments.find(item => item.id === picked) ?? firstBookable(portal.assignments);
  const [chosenDate, setChosenDate] = useState("");
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [tryLoad, setTryLoad] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [slotResult, setSlotResult] = useState<{ key: string; slots: string[]; error?: string } | null>(null);
  const closeConfirm = useCallback(() => { if (!saving) setConfirmed(false); }, [saving]);

  const earliest = assignment ? assignment.earliestBookingDate ?? gymDate(assignment.timezone) : "";
  const latest = assignment ? assignment.latestBookingDate ?? assignment.expiresOn ?? undefined : undefined;
  const date = chosenDate || earliest;
  const remaining = assignment?.available ?? 0;
  const eligible = !!assignment && (!latest || earliest <= latest)
    && (booking ? openPtBooking(booking.status) : remaining > 0 && !!assignment.trainerId && assignment.trainerStatus === "active");
  const canSelect = eligible && isCalendarDate(date) && date >= earliest && (!latest || date <= latest);
  const slotKey = `${assignment?.id ?? ""}:${date}:${booking?.id ?? ""}:${tryLoad}`;
  const effectiveAssignmentId = assignment?.id;
  const bookingId = booking?.id;
  useEffect(() => {
    if (!canSelect || !effectiveAssignmentId) return;
    let current = true;
    loadPtSlots(effectiveAssignmentId, date, bookingId).then(
      result => { if (current) setSlotResult({ key: slotKey, ...result }); },
      () => { if (current) setSlotResult({ key: slotKey, slots: [], error: "Could not check available times." }); },
    );
    return () => { current = false; };
  }, [canSelect, effectiveAssignmentId, date, bookingId, slotKey]);
  const currentResult = slotResult?.key === slotKey ? slotResult : null;
  const available = currentResult?.slots ?? [];
  const selected = available.includes(slot) ? slot : "";
  const duration = booking?.duration ?? assignment?.duration ?? 60;
  const replacingTrainer = !!booking && booking.trainerId !== assignment?.trainerId;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment || !selected || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const result = booking ? await changePtBooking(booking.id, "reschedule", date, selected, reason.trim())
        : await createPtBooking(assignment.id, date, selected);
      const id = result.id ?? booking?.id;
      if (result.error || !id) {
        setSaveError(result.error ?? "Could not confirm this booking.");
        setTryLoad(value => value + 1);
      } else {
        router.push(`/member/pt/sessions/${id}`);
        router.refresh();
      }
    } catch {
      setSaveError("Could not confirm the booking. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    <LivePtHeader title={sessionId ? "Reschedule PT Session" : "Book PT Session"} description={sessionId ? "Choose an available time for your current session trainer." : "Choose a date and available time with your assigned trainer."} />
    {portal.error ? <LivePtError message={portal.error} /> : sessionId && (!booking || !openPtBooking(booking.status)) ? <EmptyState title="This session is unavailable for rescheduling"
      description="Review the current status in My sessions."><Link className="mp-button secondary" href="/member/pt/sessions">My sessions</Link></EmptyState> : !assignment ? <EmptyState
        title="You don't have an active personal training package yet." description="Contact your gym to ask about personal training packages." /> : <>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="mp-card space-y-3">
          <h2>PT Package</h2>
          {!booking && portal.assignments.length > 1 ? <label className="block text-sm">Select PT Package
            <select className="mp-field mt-1" value={assignment.id} onChange={event => { setPicked(event.target.value); setChosenDate(""); setSlot(""); }}>
              {portal.assignments.map(item => <option key={item.id} value={item.id}>{item.packageName} · {item.trainerName} · {item.available} available</option>)}
            </select></label> : <p className="font-medium">{assignment.packageName}</p>}
          <p className="mp-muted text-sm">{remaining} available credits · {duration} minutes per session</p>
          {booking && <p className="mp-muted text-sm">Current schedule: {ptDisplayDate(booking.date)} · {booking.start}–{booking.end}</p>}
        </section>
        <section className="mp-card space-y-3">
          <h2>{replacingTrainer ? "Session Trainer" : "Your Personal Trainer"}</h2>
          {replacingTrainer ? <><p className="font-medium">{booking.trainerName}</p><p className="mp-muted text-sm">Trainer currently assigned to the package: {assignment.trainerName}</p></>
            : <PtAssignmentTrainer assignment={assignment} />}
        </section>
      </div>
      {eligible ? <>
        <section className="mp-card space-y-4">
          <h2>Select Date and Time</h2>
          <label className="block max-w-xs text-sm">Session date<input className="mp-field mt-1 min-w-0" type="date" min={earliest} max={latest} value={date}
            onChange={event => { setChosenDate(event.target.value); setSlot(""); }} /></label>
          <p className="mp-muted text-xs">Gym timezone: {assignment.timezone}</p>
          <PtWeekOptions date={date} earliest={earliest} latest={latest} assignmentId={assignment.id} bookingId={booking?.id} ready={!!currentResult}
            onSelect={next => { setChosenDate(next); setSlot(""); }} />
          {!canSelect ? <p className="mp-muted text-sm">Choose a date inside the booking window.</p>
            : !currentResult ? <p role="status" className="mp-muted text-sm">Checking available times…</p>
              : currentResult.error ? <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-danger">{currentResult.error}</p>
                <button type="button" className="mp-button secondary" onClick={() => setTryLoad(value => value + 1)}>Retry</button></div>
                : available.length ? <>
                  <p role="status" className="mp-muted text-sm">{available.length} available {available.length === 1 ? "time" : "times"} on {ptDisplayDate(date)}.</p>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Available time slots">
                    {available.map(time => <button className={`mp-button ${selected === time ? "" : "secondary"}`} type="button" key={time} aria-pressed={selected === time} onClick={() => setSlot(time)}>{time}</button>)}
                  </div>
                </> : <p role="status" className="mp-muted text-sm">No available sessions on this date. Please select another date.</p>}
        </section>
        <button className="mp-button" type="button" disabled={!selected} onClick={() => { setSaveError(""); setConfirmed(true); }}>{booking ? "Review Reschedule" : "Review Booking"}</button>
      </> : <EmptyState title="Booking unavailable" description="This package needs an active trainer, an available credit, and a valid booking date." />}
      <FormModal open={confirmed} title={booking ? "Confirm Reschedule" : "Confirm Booking"} trigger={null} onClose={closeConfirm}>
        <form className="space-y-4" onSubmit={submit}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[["Member", assignment.memberName], ["Trainer", booking?.trainerName ?? assignment.trainerName], ["PT package", assignment.packageName], ["Date", ptDisplayDate(date)],
              ["Time", selected ? `${selected}–${ptEndTime(selected, duration)}` : "Select another time"], ["Duration", `${duration} minutes`],
              ["Remaining Sessions", String(booking ? remaining : Math.max(0, remaining - 1))]].map(([label, value]) => <div key={label}><dt className="mp-muted">{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {booking && <label className="block text-sm">Reschedule Reason<textarea className="mp-field mt-1" required maxLength={300} rows={3} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} /></label>}
          {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="mp-button secondary" disabled={saving} onClick={closeConfirm}>Back</button>
            <button className="mp-button" type="submit" disabled={!selected || saving || (!!booking && !reason.trim())}>{saving ? "Saving…" : booking ? "Confirm Reschedule" : "Confirm Booking"}</button>
          </div>
        </form>
      </FormModal>
    </>}
  </div>;
}
