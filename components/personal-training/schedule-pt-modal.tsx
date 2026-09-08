"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPtSession, updatePtSession } from "@/app/actions/personal-training";
import { CreateFormModal } from "@/components/ui/create-form-modal";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";

type Assignment = { id: string; member: string; trainer: string; locationId: string; location: string };

export function SchedulePtModal({ assignments, locationId }: { assignments: Assignment[]; locationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = <form action={(fd) => startTransition(async () => { const result = await createPtSession(fd); if (result.error) { setError(result.error); return; } router.refresh(); window.dispatchEvent(new Event("repup:crud-success")); })} className="space-y-3">
    <input type="hidden" name="location_id" value={locationId} />
    <div><Label htmlFor="schedule-assignment">PT Client *</Label><Select id="schedule-assignment" name="assignment_id" required defaultValue=""><option value="">Pilih client</option>{assignments.map((item) => <option key={item.id} value={item.id}>{item.member} · {item.trainer}</option>)}</Select></div>
    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="schedule-date">Tanggal *</Label><Input id="schedule-date" name="session_date" type="date" required /></div><div><Label htmlFor="schedule-time">Mulai *</Label><Input id="schedule-time" name="start_time" type="time" required /></div></div>
    <div><Label htmlFor="schedule-duration">Durasi (menit)</Label><Input id="schedule-duration" name="duration_minutes" type="number" min="15" step="15" defaultValue="60" required /></div>
    <div><Label htmlFor="schedule-notes">Notes</Label><Textarea id="schedule-notes" name="notes" rows={2} placeholder="Opsional" /></div>
    <FieldError>{error ?? undefined}</FieldError><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Schedule PT"}</Button>
  </form>;
  return <CreateFormModal title="Schedule PT" description="Jadwalkan sesi untuk client yang sudah assigned." label="+ Schedule PT" form={form} />;
}

export function EditPtSessionForm({ session }: { session: { id: string; session_date: string; start_time: string; duration_minutes: number; status: string; notes: string | null } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <form action={(fd) => startTransition(async () => { const result = await updatePtSession(fd); if (result.error) { setError(result.error); return; } router.refresh(); })} className="space-y-3"><input type="hidden" name="id" value={session.id} /><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="edit-session-date">Tanggal</Label><Input id="edit-session-date" name="session_date" type="date" defaultValue={session.session_date} required /></div><div><Label htmlFor="edit-session-time">Mulai</Label><Input id="edit-session-time" name="start_time" type="time" defaultValue={session.start_time?.slice(0, 5)} required /></div></div><div><Label htmlFor="edit-session-duration">Durasi (menit)</Label><Input id="edit-session-duration" name="duration_minutes" type="number" min="15" step="15" defaultValue={session.duration_minutes} required /></div><div><Label htmlFor="edit-session-status">Status</Label><Select id="edit-session-status" name="status" defaultValue={session.status}><option value="scheduled">Scheduled</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="no_show">No Show</option><option value="cancelled">Cancelled</option></Select></div><div><Label htmlFor="edit-session-notes">Notes</Label><Textarea id="edit-session-notes" name="notes" rows={3} defaultValue={session.notes ?? ""} /></div><FieldError>{error ?? undefined}</FieldError><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Jadwal"}</Button></form>;
}
