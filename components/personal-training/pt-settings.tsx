"use client";

import { useState, type FormEvent } from "react";
import { loadPtSettings, savePtSettings } from "@/app/actions/pt-bookings";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Select } from "@/components/ui/field";
import type { PtSettings } from "@/lib/pt-bookings";

const fields = [
  { key: "approvalMinutes", label: "Approval Expiry (minutes)", min: 1, max: 10080 },
  { key: "bufferMinutes", label: "Session Buffer (minutes)", min: 0, max: 120 },
  { key: "noticeMinutes", label: "Minimum Booking Notice (minutes)", min: 0, max: 10080 },
  { key: "advanceDays", label: "Maximum Advance Booking (days)", min: 1, max: 365 },
  { key: "lateCancelHours", label: "Late Cancellation Window (hours)", min: 0, max: 168 },
] as const;

export function PtSettingsForm({ initial }: { initial: PtSettings | null }) {
  const [settings, setSettings] = useState(initial);
  const [feedback, setFeedback] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, setPending] = useState(false);

  async function reload() {
    setPending(true);
    setFeedback({});
    try {
      const value = await loadPtSettings();
      setSettings(value);
    } catch {
      setSettings(null);
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !settings) return;
    const values = new FormData(event.currentTarget);
    const next = { ...settings };
    for (const { key } of fields) {
      const value = values.get(key);
      if (typeof value === "string" && value !== "") next[key] = Number(value);
    }
    next.intervalMinutes = Number(values.get("intervalMinutes"));
    next.confirmation = values.get("confirmation") === "approval" ? "approval" : "auto";
    next.chargeLateCancel = values.has("chargeLateCancel");
    next.chargeNoShow = values.has("chargeNoShow");

    setPending(true);
    setFeedback({});
    try {
      const result = await savePtSettings(next);
      if (result.error) setFeedback({ error: result.error });
      else {
        setSettings(next);
        setFeedback({ saved: true });
      }
    } catch {
      setFeedback({ error: "Could not save Personal Training settings. Try again." });
    } finally {
      setPending(false);
    }
  }

  if (!settings) return <div className="space-y-3">
    {pending ? <p role="status" className="text-sm text-ink-muted">Loading Personal Training settings…</p> : <p role="alert" className="text-sm text-danger">Could not load Personal Training settings.</p>}
    <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => void reload()}>Retry</Button>
  </div>;

  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <label className="block text-sm">Booking Confirmation Mode
        <Select name="confirmation" className="mt-1" defaultValue={settings.confirmation}>
          <option value="auto">Auto Confirm</option><option value="approval">Trainer Approval</option>
        </Select>
      </label>
      <p className="text-xs text-ink-muted">Trainer Approval reserves the slot and session credit until the trainer responds or the request expires.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm">Slot Interval
          <Select name="intervalMinutes" className="mt-1" defaultValue={settings.intervalMinutes}>
            {[15, 30, 45, 60].map(minutes => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
          </Select>
        </label>
        {fields.map(({ key, label, min, max }) => <label key={key} className="block min-w-0 text-sm">{label}
          <Input name={key} className="mt-1" defaultValue={settings[key]} type="number" min={min} max={max} step="1" required />
        </label>)}
      </div>
      <div className="space-y-3 border-t border-line pt-4">
        <label className="flex items-start gap-2 text-sm"><input className="mt-1 accent-primary" type="checkbox" name="chargeLateCancel" defaultChecked={settings.chargeLateCancel} /> Deduct a session credit for late member cancellations</label>
        <label className="flex items-start gap-2 text-sm"><input className="mt-1 accent-primary" type="checkbox" name="chargeNoShow" defaultChecked={settings.chargeNoShow} /> Deduct a session credit for no-shows</label>
      </div>
    </fieldset>
    {feedback.error && <div role="alert"><FieldError>{feedback.error}</FieldError></div>}
    {feedback.saved && <p role="status" className="text-sm text-success">Personal Training settings saved.</p>}
    <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save Personal Training Settings"}</Button>
  </form>;
}
