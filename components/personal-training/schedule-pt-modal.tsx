"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPtSession, updatePtSession } from "@/app/actions/personal-training";
import { loadPtSlots } from "@/app/actions/pt-bookings";
import { CreateFormModal } from "@/components/ui/create-form-modal";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Select, Textarea } from "@/components/ui/field";
import { formatDate } from "@/lib/format";

type Assignment = { id: string; member: string; trainer: string; locationId: string; location: string };
type SlotResult = { slots: string[]; error?: string };

function SlotFields({ assignmentId, sessionId }: { assignmentId: string; sessionId?: string }) {
  const [date, setDate] = useState("");
  const [result, setResult] = useState<SlotResult | null>(null);
  useEffect(() => {
    if (!assignmentId || !date) return;
    let active = true;
    loadPtSlots(assignmentId, date, sessionId).then(
      value => { if (active) setResult(value); },
      () => { if (active) setResult({ slots: [], error: "Could not load available sessions." }); },
    );
    return () => { active = false; };
  }, [assignmentId, date, sessionId]);
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm">Date<Input className="mt-1" name="session_date" type="date" required disabled={!assignmentId}
      value={date} onChange={event => { setDate(event.target.value); setResult(null); }} /></label>
    <label className="text-sm">Available time<Select className="mt-1" name="start_time" required disabled={!result?.slots.length} key={date}>
      <option value="">Select time</option>{result?.slots.map(slot => <option value={slot} key={slot}>{slot}</option>)}
    </Select></label>
    {date && <p role={result?.error ? "alert" : "status"} className="text-xs text-ink-muted sm:col-span-2">
      {result?.error ?? (!result ? "Loading available times…" : !result.slots.length ? "No available sessions on this date. Please select another date." : "Duration follows the purchased package.")}
    </p>}
  </div>;
}

function useBookingForm(action: typeof createPtSession | typeof updatePtSession) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, transition] = useTransition();
  function save(fd: FormData) {
    transition(async () => {
      setError("");
      try {
        const result = await action(fd);
        if (result.error) { setError(result.error); return; }
        router.refresh();
        window.dispatchEvent(new Event("repup:crud-success"));
      } catch { setError("Could not save this booking."); }
    });
  }
  return { error, pending, save };
}

export function SchedulePtModal({ assignments }: { assignments: Assignment[]; locationId: string }) {
  const [assignmentId, setAssignmentId] = useState("");
  const { error, pending, save } = useBookingForm(createPtSession);
  const form = <form action={save} className="space-y-3">
    <label className="text-sm">PT Client<Select className="mt-1" name="assignment_id" value={assignmentId} required onChange={event => setAssignmentId(event.target.value)}>
      <option value="">Select member package</option>{assignments.map(item => <option key={item.id} value={item.id}>{item.member} · {item.trainer}</option>)}
    </Select></label>
    <SlotFields key={assignmentId} assignmentId={assignmentId} />
    <FieldError>{error}</FieldError>
    <Button type="submit" disabled={pending || !assignmentId}>{pending ? "Booking…" : "Confirm Booking"}</Button>
  </form>;
  return <CreateFormModal title="Schedule PT" description="Book an available slot with the assigned trainer." label="+ Schedule PT" form={form} />;
}

export function EditPtSessionForm({ session }: { session: {
  id: string; pt_client_assignment_id: string; session_date: string; start_time: string; duration_minutes: number; status: string;
} }) {
  const { error, pending, save } = useBookingForm(updatePtSession);
  const [operation, setOperation] = useState("reschedule");
  if (!["scheduled", "confirmed", "pending_approval"].includes(session.status)) return null;
  const form = <form action={save} className="space-y-3">
    <input type="hidden" name="id" value={session.id} />
    <p className="text-sm text-ink-muted">{formatDate(session.session_date)} · {session.start_time.slice(0, 5)} · {session.duration_minutes} min</p>
    <label className="text-sm">Action<Select className="mt-1" name="operation" value={operation} onChange={event => setOperation(event.target.value)}>
      <option value="reschedule">Reschedule</option><option value="cancel">Cancel Booking</option>
      {session.status === "pending_approval" ? <><option value="approve">Approve</option><option value="reject">Reject</option></> :
        <><option value="complete">Complete</option><option value="no_show">Mark No Show</option></>}
    </Select></label>
    {operation === "reschedule" && <SlotFields assignmentId={session.pt_client_assignment_id} sessionId={session.id} />}
    {["reschedule", "cancel", "reject"].includes(operation) && <label className="text-sm">Reason<Textarea className="mt-1" name="reason" rows={3} maxLength={300} required /></label>}
    <FieldError>{error}</FieldError>
    <Button type="submit" variant={operation === "cancel" ? "danger" : "primary"} disabled={pending}>{pending ? "Saving…" : operation === "cancel" ? "Confirm Cancellation" : "Confirm Action"}</Button>
  </form>;
  return <CreateFormModal title="Manage Booking" label="Manage Booking" form={form} />;
}
