"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, FieldError } from "@/components/ui/field";
import { openSession, type ManagedTrainer, type TrainerSession, type TrainerStatus } from "@/lib/trainer-management";

const specialties = ["Strength", "Hypertrophy", "Weight Loss", "Functional Training", "Bodybuilding", "Mobility", "Endurance", "Sports Conditioning"];

export function TrainerPhoto({ name, photo }: { name: string; photo?: string | null }) {
  return photo ? (
    // Trainer photos may come from an existing remote profile or a validated inline upload.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt={`Profile photo of ${name}`} className="size-10 shrink-0 rounded-full border border-line object-cover" />
  ) : <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">{name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>;
}

export function ManagedTrainerForm({ trainer, packageNames = [], sessions = [], branches, selectedBranches = [], onSave, onClose, onPendingChange }: {
  trainer?: ManagedTrainer;
  packageNames?: string[];
  sessions?: TrainerSession[];
  branches?: { id: string; name: string }[];
  selectedBranches?: string[];
  onSave: (formData: FormData) => Promise<{ error?: string }>;
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<TrainerStatus>(trainer?.status ?? "active");
  const [now] = useState(() => Date.now());
  const options = [...new Set([...specialties, ...(trainer?.specializations ?? [])])];
  const affected = status === "active" ? [] : sessions.filter(session => openSession(session.status) && Date.parse(session.scheduledAt) >= now
    && !(session.status === "pending_approval" && session.approvalExpiresAt && Date.parse(session.approvalExpiresAt) <= now));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const photo = data.get("photo");
    if (photo instanceof File && photo.size && (photo.size > 512 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(photo.type))) {
      setError("Use a JPG, PNG, or WebP image up to 512 KB.");
      return;
    }
    setPending(true);
    onPendingChange(true);
    setError("");
    try {
      const result = await onSave(data);
      if (result.error) setError(result.error);
    } catch {
      setError("Could not save the trainer. Try again.");
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }

  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      {branches && <fieldset className="flex flex-wrap gap-4 rounded-lg border border-line p-3"><legend className="px-1 text-sm font-medium">Assigned branches</legend>{branches.map(branch =>
        <label key={branch.id} className="flex items-center gap-2 text-sm"><input name="demoBranchIds" type="checkbox" value={branch.id} defaultChecked={selectedBranches.includes(branch.id)} />{branch.name}</label>)}</fieldset>}
      {trainer?.photo && <TrainerPhoto name={trainer.name} photo={trainer.photo} />}
      <label className="block text-sm">Profile Photo<Input className="mt-1" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /><span className="mt-1 block text-xs text-ink-muted">JPEG, PNG or WebP. Up to 512 KB.</span></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">Full Name<Input className="mt-1" name="name" required maxLength={100} defaultValue={trainer?.name ?? ""} /></label>
        <label className="block text-sm">Trainer Code<Input className="mt-1" value={trainer?.code || "Generated when saved"} readOnly /></label>
        <label className="block text-sm">Phone Number<Input className="mt-1" name="phone" type="tel" required maxLength={23} defaultValue={trainer?.phone ?? ""} /></label>
        <label className="block text-sm">Email<Input className="mt-1" name="email" type="email" maxLength={254} defaultValue={trainer?.email ?? ""} /></label>
        <label className="block text-sm">Gender (optional)<Select className="mt-1" name="gender" defaultValue={trainer?.gender ?? ""}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></label>
        <label className="block text-sm">Years of Experience<Input className="mt-1" name="experience" type="number" min={0} max={100} step={1} required defaultValue={trainer?.experience ?? 0} /></label>
        <label className="block text-sm">Employment Type<Select className="mt-1" name="employment" defaultValue={trainer?.employment ?? "freelance"}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="freelance">Freelance</option></Select></label>
        <label className="block text-sm">Status<Select className="mt-1" name="status" value={status} onChange={event => setStatus(event.target.value as TrainerStatus)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On Leave</option></Select></label>
        <label className="block text-sm">Default Session Rate (IDR)<Input className="mt-1" name="rate" type="number" min={0} max={999999999} step="0.01" required defaultValue={trainer?.rate ?? 0} /></label>
        <label className="block text-sm">Session Duration<Select className="mt-1" name="duration" defaultValue={trainer?.duration ?? 60}>{[30, 45, 60, 90].map(minutes => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</Select></label>
      </div>
      {affected.length > 0 && <div role="status" className="rounded-lg border border-line bg-elevated p-3 text-sm">
        <p>Review these {affected.length} upcoming {affected.length === 1 ? "booking" : "bookings"}. Existing bookings keep their schedules.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">{affected.map(session => <li key={session.id}>{session.memberName} · {session.date} · {session.start}–{session.end}</li>)}</ul>
      </div>}
      <fieldset className="rounded-lg border border-line p-3">
        <legend className="px-1 text-sm font-medium">Specialization</legend>
        <div className="grid gap-2 sm:grid-cols-2">{options.map(item => <label key={item} className="flex items-center gap-2 text-sm"><input className="accent-primary" type="checkbox" name="specializations" value={item} defaultChecked={trainer?.specializations.includes(item)} />{item}</label>)}</div>
      </fieldset>
      <label className="block text-sm">Short Biography<Textarea className="mt-1" name="bio" rows={3} maxLength={1000} defaultValue={trainer?.bio ?? ""} /></label>
      <label className="block text-sm">Certifications (optional)<Textarea className="mt-1" name="certifications" rows={2} maxLength={1000} defaultValue={trainer?.certifications ?? ""} /></label>
      <div className="rounded-lg border border-dashed border-line p-3 text-sm"><p className="font-medium">Assigned PT Packages</p>
        <p className="mt-1 text-ink-muted">{packageNames.length ? packageNames.join(", ") : "No packages linked through active PT clients."}</p></div>
    </fieldset>
    {error && <div role="alert"><FieldError>{error}</FieldError></div>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
      <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancel</Button>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save Trainer"}</Button>
    </div>
  </form>;
}
