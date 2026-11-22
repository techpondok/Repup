"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/layout-bits";
import { openSession, trainerAllowsSlot, validateTrainerAvailability, type Availability, type TrainerSession } from "@/lib/trainer-management";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const blank: Availability = { weekly: [], timeOff: [] };
const timeOffTypes = { leave: "Leave", day_off: "Day Off", unavailable: "Unavailable" } as const;

export function TrainerAvailability({ availability, sessions, canManage, timezone, onSave }: {
  availability: Availability | null;
  sessions: TrainerSession[];
  canManage: boolean;
  timezone: string;
  onSave: (value: Availability) => Promise<{ error?: string; conflicts?: number }>;
}) {
  const [draft, setDraft] = useState(availability ?? blank);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; conflicts?: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [now] = useState(() => Date.now());
  const disabledRanges = useRef(new Map<number, Availability["weekly"]>());
  const conflicts = sessions.filter(session => openSession(session.status) && Date.parse(session.scheduledAt) >= now
    && !(session.approvalExpiresAt && session.status === "pending_approval" && Date.parse(session.approvalExpiresAt) <= now)
    && !trainerAllowsSlot(editing ? draft : availability, session.date, session.start, session.end));

  function updateRange(index: number, patch: Partial<Availability["weekly"][number]>) {
    setDraft(previous => ({ ...previous, weekly: previous.weekly.map((range, i) => i === index ? { ...range, ...patch } : range) }));
  }

  function updateTimeOff(index: number, patch: Partial<Availability["timeOff"][number]>) {
    setDraft(previous => ({ ...previous, timeOff: previous.timeOff.map((entry, i) => i === index ? { ...entry, ...patch } : entry) }));
  }

  function toggleDay(day: number, enabled: boolean) {
    const existing = draft.weekly.filter(range => range.day === day);
    if (!enabled) disabledRanges.current.set(day, existing);
    const next = enabled ? disabledRanges.current.get(day) ?? [{ day, start: "08:00", end: "12:00", kind: "available" as const }] : [];
    setDraft({ ...draft, weekly: [...draft.weekly.filter(range => range.day !== day), ...next] });
  }

  function copyDay(source: number, target: number) {
    const copied = draft.weekly.filter(range => range.day === source).map(range => ({ ...range, day: target }));
    setDraft({ ...draft, weekly: [...draft.weekly.filter(range => range.day !== target), ...copied] });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const error = validateTrainerAvailability(draft);
    if (error) {
      setFeedback({ error });
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      const result = await onSave(draft);
      setFeedback(result);
      if (!result.error) setEditing(false);
    } catch {
      setFeedback({ error: "Could not save availability. Try again." });
    } finally {
      setPending(false);
    }
  }

  const weekly = editing ? draft.weekly : availability?.weekly ?? [];
  const timeOff = editing ? draft.timeOff : availability?.timeOff ?? [];
  return <Card className="space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-semibold">Weekly availability</h3><p className="mt-1 text-xs text-ink-muted">{timezone} · Existing bookings retain their schedules.</p></div>
      {canManage && !editing && <Button type="button" variant="secondary" size="sm" onClick={() => { disabledRanges.current.clear(); setDraft(availability ?? blank); setFeedback(null); setEditing(true); }}>Edit Availability</Button>}
    </div>
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={pending || !editing} className="min-w-0 space-y-4">
        <div className="divide-y divide-line rounded-lg border border-line">
          {weekdays.map((day, offset) => {
            const dayNumber = offset + 1;
            const dayRanges = weekly.map((range, index) => ({ range, index })).filter(({ range }) => range.day === dayNumber);
            const enabled = dayRanges.length > 0;
            return <div key={day} className="space-y-2 px-3 py-2.5 sm:grid sm:grid-cols-[7rem_1fr] sm:items-start sm:gap-3 sm:space-y-0">
              <div>
                <p className="py-1 text-sm font-medium">{day}</p>
                {editing && <label className="flex items-center gap-2 text-xs text-ink-muted"><input type="checkbox" checked={enabled} onChange={event => toggleDay(dayNumber, event.target.checked)} aria-label={`${day} available`} className="accent-primary" />Available</label>}
              </div>
              <div className="min-w-0 space-y-2">
                {!enabled && !editing && <p className="py-1 text-sm text-ink-muted">Unavailable</p>}
                {dayRanges.map(({ range, index }) => editing ? <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                  <Select className="col-span-2 sm:col-span-1" aria-label={`${day} range type`} value={range.kind} onChange={event => updateRange(index, { kind: event.target.value === "break" ? "break" : "available" })}><option value="available">Available</option><option value="break">Break</option></Select>
                  <div className="col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:col-span-1">
                    <Input className="min-w-0 px-2" aria-label={`${day} start time`} type="time" required value={range.start} onChange={event => updateRange(index, { start: event.target.value })} />
                    <Input className="min-w-0 px-2" aria-label={`${day} end time`} type="time" required value={range.end} onChange={event => updateRange(index, { end: event.target.value })} />
                  </div>
                  <Button className="col-start-3 row-start-1 sm:row-start-auto" type="button" variant="ghost" size="sm" aria-label={`Remove ${day} range`} onClick={() => setDraft(previous => ({ ...previous, weekly: previous.weekly.filter((_, i) => i !== index) }))}><Trash2 size={16} /></Button>
                </div> : <p key={index} className="text-sm text-ink-muted">{range.start}–{range.end}{range.kind === "break" ? " · Break" : ""}</p>)}
                {editing && enabled && <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" aria-label={`Add ${day} time range`} onClick={() => setDraft(previous => ({ ...previous, weekly: [...previous.weekly, { day: dayNumber, start: "08:00", end: "12:00", kind: "available" }] }))}><Plus size={14} /> Add range</Button>
                  <Select className="w-auto min-w-0" aria-label={`Copy ${day} schedule to another day`} value="" onChange={event => { if (event.target.value) copyDay(dayNumber, Number(event.target.value)); }}>
                    <option value="">Copy schedule to…</option>
                    {weekdays.map((target, index) => index !== offset && <option key={target} value={index + 1}>{target}{draft.weekly.some(range => range.day === index + 1) ? " (replace)" : ""}</option>)}
                  </Select>
                </div>}
              </div>
            </div>;
          })}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Time off</h4>
          {!timeOff.length && <p className="text-sm text-ink-muted">No time off scheduled.</p>}
          {timeOff.map((entry, index) => editing ? <div key={index} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm">Start Date<Input className="mt-1" type="date" required value={entry.date} onChange={event => updateTimeOff(index, { date: event.target.value })} /></label>
            <label className="min-w-0 text-sm">End Date<Input className="mt-1" type="date" min={entry.date || undefined} value={entry.endDate || ""} onChange={event => updateTimeOff(index, { endDate: event.target.value || undefined })} /></label>
            <label className="min-w-0 text-sm">Start Time (optional)<Input className="mt-1" type="time" value={entry.startTime || ""} onChange={event => updateTimeOff(index, { startTime: event.target.value || undefined })} /></label>
            <label className="min-w-0 text-sm">End Time (optional)<Input className="mt-1" type="time" value={entry.endTime || ""} onChange={event => updateTimeOff(index, { endTime: event.target.value || undefined })} /></label>
            <label className="min-w-0 text-sm">Type<Select className="mt-1" value={entry.type ?? "unavailable"} onChange={event => updateTimeOff(index, { type: event.target.value as keyof typeof timeOffTypes })}>
              {Object.entries(timeOffTypes).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </Select></label>
            <label className="min-w-0 text-sm">Reason<Input className="mt-1" maxLength={160} value={entry.reason} onChange={event => updateTimeOff(index, { reason: event.target.value })} /></label>
            <Button className="justify-self-start" type="button" variant="ghost" size="sm" onClick={() => setDraft(previous => ({ ...previous, timeOff: previous.timeOff.filter((_, i) => i !== index) }))}><Trash2 size={16} /> Remove time off</Button>
          </div> : <div key={index} className="text-sm text-ink-muted">
            <p>{timeOffTypes[entry.type ?? "unavailable"]} · {entry.date}{entry.startTime ? ` ${entry.startTime}` : ""}{entry.endDate && entry.endDate !== entry.date || entry.endTime ? ` – ${entry.endDate && entry.endDate !== entry.date ? entry.endDate : ""} ${entry.endTime ?? ""}`.trimEnd() : ""}</p>
            {entry.reason && <p className="text-xs">{entry.reason}</p>}
          </div>)}
          {editing && <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(previous => ({ ...previous, timeOff: [...previous.timeOff, { date: "", type: "unavailable", reason: "" }] }))}><Plus size={14} /> Add time off</Button>}
        </div>
      </fieldset>
      {conflicts.length > 0 && <div role="status" className="rounded-lg border border-line bg-elevated p-3 text-sm text-ink">
        <p>{editing ? "This change affects" : "Current availability conflicts with"} {conflicts.length} upcoming {conflicts.length === 1 ? "booking" : "bookings"}. Existing bookings keep their schedules.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">{conflicts.map(session => <li key={session.id}>{session.memberName} · {session.date} · {session.start}–{session.end}</li>)}</ul>
      </div>}
      {feedback && <p role={feedback.error ? "alert" : "status"} className={feedback.error ? "text-sm text-danger" : "text-sm text-ink-muted"}>{feedback.error ?? (feedback.conflicts ? `Availability saved. ${feedback.conflicts} conflicting bookings remain scheduled.` : "Availability saved.")}</p>}
      {editing && <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => { setFeedback(null); setEditing(false); }}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Availability"}</Button></div>}
    </form>
  </Card>;
}
