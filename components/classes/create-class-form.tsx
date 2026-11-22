"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { Card, PageHeader } from "@/components/ui/layout-bits";
import { TrainerPhoto } from "@/components/trainers/managed-trainer-form";
import { TrainerStatus } from "@/components/trainers/trainer-detail";
import { useClasses } from "@/components/member/classes/class-provider";
import { packages } from "@/lib/demo/member-management";
import { formatCurrency } from "@/lib/format";
import { useTrainerDemo } from "@/components/trainers/trainer-demo-provider";
import { isTrainerPhoto } from "@/lib/trainer-management";
import { classCategories, classDate, classDateKey, type ClassRules } from "@/lib/member/classes";
import { buildClassSessions, classEndTime, defaultCover, difficulties, initialClass, maxSessions, operatingHours, rooms, validateClass, weekdays, yogaExample, type ClassBranch, type ClassDraft } from "@/lib/member/class-creation";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-4 border-b border-line p-4 last:border-b-0 sm:p-5">
    <h2 className="font-semibold text-ink">{title}</h2>{children}
  </section>;
}

function Field({ name, label, error, children }: { name: string; label: string; error?: string; children: ReactNode }) {
  return <div className="min-w-0">
    <Label htmlFor={name}>{label}</Label>{children}
    {error && <div id={`${name}-error`} role="alert"><FieldError>{error}</FieldError></div>}
  </div>;
}

function Toggle({ checked, label, change }: { checked: boolean; label: string; change: (checked: boolean) => void }) {
  return <label className="flex min-h-10 w-fit items-center gap-2 text-sm">
    <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={event => change(event.target.checked)} />{label}
  </label>;
}

const grid = "grid gap-4 sm:grid-cols-2";
const durations = [30, 45, 60, 90];

export function CreateClassForm({ branches, defaultBranch }: { branches: ClassBranch[]; defaultBranch: string }) {
  const router = useRouter();
  const { state, dispatch } = useClasses();
  const { details: trainers } = useTrainerDemo();
  const [draft, setDraft] = useState(() => initialClass(defaultBranch));
  const [now, setNow] = useState(() => Date.now());
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [confirm, setConfirm] = useState<ClassDraft["visibility"] | null>(null);
  const [leave, setLeave] = useState("");
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState(false);
  const [imagePending, setImagePending] = useState(false);
  const [imageError, setImageError] = useState("");
  const submitting = useRef(false);
  const backGuard = useRef(false);
  const { slots, errors, trainer, branch } = validateClass(draft, trainers, branches, state.schedules, now);
  const visibleTrainers = trainers.filter(({ trainer: item }) =>
    `${item.name} ${item.specializations.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()) || item.id === draft.trainerId);
  const invalid = (field: keyof typeof errors) => Boolean(reviewed && errors[field]);
  const control = (field: keyof typeof errors) => ({ id: field, "aria-invalid": invalid(field), "aria-describedby": invalid(field) ? `${field}-error` : undefined });
  const error = (field: keyof typeof errors) => reviewed ? errors[field] : undefined;
  const price = draft.rules.paid ? formatCurrency(draft.rules.memberPrice || 0) : "Included in Membership";
  const firstSlot = slots[0];

  function patch(values: Partial<ClassDraft>) {
    setDirty(true);
    setDraft(previous => ({ ...previous, ...values }));
  }

  function rule<Key extends keyof ClassRules>(key: Key, value: ClassRules[Key]) {
    setDirty(true);
    setDraft(previous => ({ ...previous, rules: { ...previous.rules, [key]: value } }));
  }

  useEffect(() => {
    if (!dirty) return;
    const formUrl = location.href;
    function armBackGuard() {
      history.pushState(history.state, "", formUrl);
      backGuard.current = true;
    }
    function guardBack() {
      if (submitting.current || !backGuard.current || location.href !== formUrl) return;
      backGuard.current = false;
      setConfirm(null);
      setLeave("back");
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (submitting.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function navigate(event: MouseEvent) {
      if (submitting.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") as HTMLAnchorElement | null : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault();
      setConfirm(null);
      setLeave(url.pathname + url.search + url.hash);
    }
    if (!backGuard.current) armBackGuard();
    window.addEventListener("popstate", guardBack);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("popstate", guardBack);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);

  function validateForSave(visibility: ClassDraft["visibility"]) {
    if (imagePending) return;
    const time = Date.now();
    setNow(time);
    setReviewed(true);
    if (Object.keys(validateClass(draft, trainers, branches, state.schedules, time).errors).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("#class-form [aria-invalid=true], #class-form [role=alert]")?.scrollIntoView({ block: "center" }));
      return;
    }
    setConfirm(visibility);
  }

  function save() {
    if (!confirm || submitting.current) return;
    const result = validateClass(draft, trainers, branches, state.schedules, Date.now());
    if (Object.keys(result.errors).length || !result.trainer || !result.branch) {
      setConfirm(null);
      setNow(Date.now());
      return;
    }
    submitting.current = true;
    dispatch({ type: "create", sessions: buildClassSessions({ ...draft, visibility: confirm }, result.slots, result.trainer, result.branch, crypto.randomUUID()) });
    router.replace("/classes");
  }

  function cancel() {
    if (dirty) setLeave("/classes");
    else router.push("/classes");
  }

  function keepEditing() {
    if (leave === "back" && !backGuard.current) {
      history.pushState(history.state, "", location.href);
      backGuard.current = true;
    }
    setLeave("");
  }

  function discard() {
    submitting.current = true;
    setDirty(false);
    if (leave === "back") router.back();
    else router.replace(leave);
  }

  function numberRule(key: "opensMinutes" | "closesMinutes" | "waitlistLimit" | "minimum" | "memberPrice" | "walkInPrice" | "checkInMinutes" | "lateMinutes", label: string) {
    return <Field name={key} label={label} error={error(key)}>
      <Input {...control(key)} type="number" min={0} value={Number.isNaN(draft.rules[key]) ? "" : draft.rules[key]}
        onChange={event => rule(key, event.target.value === "" && key === "minimum" ? 0 : event.target.valueAsNumber)} />
    </Field>;
  }

  return <div className="mx-auto max-w-[1400px] space-y-4">
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted">
      <Link href="/classes" className="font-medium hover:text-primary">Classes</Link><span aria-hidden="true">/</span><span aria-current="page">Create Class</span>
    </nav>
    <PageHeader title="Create New Class" description="Set up a new fitness class, schedule, instructor, and booking rules." actions={<>
      <Button type="button" variant="secondary" onClick={cancel}>Cancel</Button>
      <Button type="submit" form="class-form" disabled={imagePending}>Create Class</Button>
    </>} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <Card>
        <form id="class-form" noValidate onSubmit={event => { event.preventDefault(); validateForSave(draft.visibility); }}>
          <Section title="Class Information">
            <div className="flex justify-end"><Button type="button" variant="secondary" size="sm" onClick={() => {
              const sarah = trainers.find(item => item.trainer.name === "Sarah Putri");
              patch(yogaExample(draft.branchId, Date.now(), sarah?.trainer.id ?? ""));
              setCustom(false); setSearch(""); setImageError(""); setReviewed(false);
            }}>Load Morning Yoga Example</Button></div>
            <div className={grid}>
              <Field name="name" label="Class Name" error={error("name")}><Input {...control("name")} maxLength={100} value={draft.name} onChange={e => patch({ name: e.target.value })} /></Field>
              <Field name="category" label="Class Category" error={error("category")}><Select {...control("category")} value={draft.category} onChange={e => patch({ category: e.target.value as ClassDraft["category"] })}>
                <option value="">Select category</option>{classCategories.map(item => <option key={item}>{item}</option>)}
              </Select></Field>
              <Field name="difficulty" label="Difficulty Level"><Select id="difficulty" value={draft.difficulty} onChange={e => patch({ difficulty: e.target.value })}>{difficulties.map(item => <option key={item}>{item}</option>)}</Select></Field>
              <Field name="duration-preset" label="Session Duration" error={!custom ? error("duration") : undefined}>
                <Select id="duration-preset" value={custom ? "custom" : draft.duration} onChange={e => { setCustom(e.target.value === "custom"); if (e.target.value !== "custom") patch({ duration: Number(e.target.value) }); }}>
                  {durations.map(minutes => <option value={minutes} key={minutes}>{minutes} minutes</option>)}<option value="custom">Custom Duration</option>
                </Select>
              </Field>
              {custom && <Field name="duration" label="Custom Duration (minutes)" error={error("duration")}>
                <Input {...control("duration")} type="number" min={1} value={draft.duration || ""} onChange={e => patch({ duration: e.target.valueAsNumber || 0 })} />
              </Field>}
            </div>
            <Field name="description" label="Description"><Textarea id="description" rows={3} maxLength={1000} value={draft.description} onChange={e => patch({ description: e.target.value })} /></Field>
            <Field name="image" label="Cover Image" error={imageError}>
              <Input id="image" aria-describedby={imageError ? "image-error" : undefined} type="file" accept="image/jpeg,image/png,image/webp" disabled={imagePending} onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setImageError("");
                setImagePending(true);
                try {
                  if (file.size > 3_000_000 || !await isTrainerPhoto(file)) throw new Error("Choose a valid JPG, PNG or WebP under 3 MB.");
                  const image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error("Could not read the cover image."));
                    reader.readAsDataURL(file);
                  });
                  patch({ image });
                } catch (problem) {
                  setImageError(problem instanceof Error ? problem.message : "Unable to read the cover image.");
                } finally { setImagePending(false); }
              }} />
            </Field>
            {imagePending && <p role="status" className="text-sm text-ink-muted">Reading image…</p>}
            {draft.image && <Button type="button" variant="ghost" size="sm" onClick={() => patch({ image: "" })}>Remove Cover Image</Button>}
          </Section>
          <Section title="Instructor & Location">
            <div className={grid}>
              <Field name="trainer-search" label="Search Instructors"><Input id="trainer-search" type="search" value={search} placeholder="Name or specialization" onChange={e => setSearch(e.target.value)} /></Field>
              <Field name="trainerId" label="Assign Instructor" error={error("trainerId")}>
                <Select {...control("trainerId")} value={draft.trainerId} onChange={e => patch({ trainerId: e.target.value })}>
                  <option value="">{visibleTrainers.length ? "Choose an instructor" : "No instructors match"}</option>
                  {visibleTrainers.map(({ trainer: item }) => <option key={item.id} value={item.id} disabled={item.status !== "active"}>
                    {item.name} · {item.specializations.join(", ")}{item.status !== "active" ? ` · ${item.status.replace("_", " ")}` : ""}
                  </option>)}
                </Select>
              </Field>
              <Field name="branchId" label="Gym Branch" error={error("branchId")}><Select {...control("branchId")} value={draft.branchId} onChange={e => patch({ branchId: e.target.value })}>
                <option value="">Select a branch</option>{branches.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
              </Select></Field>
              <Field name="room" label="Studio / Room" error={error("room")}><Select {...control("room")} value={draft.room} onChange={e => patch({ room: e.target.value })}>
                <option value="">Select a room</option>{rooms.map(room => <option key={room}>{room}</option>)}
              </Select></Field>
            </div>
            {trainer && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-canvas p-3">
              <TrainerPhoto name={trainer.trainer.name} photo={trainer.trainer.photo} />
              <div className="min-w-0 flex-1 text-sm"><p className="font-medium">{trainer.trainer.name}</p><p className="text-xs text-ink-muted">{trainer.trainer.specializations.join(", ")}</p></div>
              <TrainerStatus status={trainer.trainer.status} />
            </div>}
          </Section>
          <Section title="Class Schedule">
            <div className={grid}>
              <Field name="schedule-type" label="Schedule Type"><Select id="schedule-type" value={draft.recurring ? "recurring" : "single"} onChange={e => patch({ recurring: e.target.value === "recurring" })}>
                <option value="single">Single Class</option><option value="recurring">Recurring Class</option>
              </Select></Field>
              <Field name="date" label={draft.recurring ? "Start Date" : "Class Date"} error={error("date")}>
                <Input {...control("date")} type="date" min={classDateKey(new Date(now))} value={draft.date} onChange={e => patch({ date: e.target.value })} />
              </Field>
              {!draft.recurring && <>
                <Field name="start" label="Start Time (WIB)" error={error("start")}><Input {...control("start")} type="time" value={draft.start} onChange={e => patch({ start: e.target.value })} /></Field>
                <Field name="end-time" label="End Time (WIB)"><Input id="end-time" value={classEndTime(draft.start, draft.duration)} readOnly placeholder="Calculated from duration" /></Field>
              </>}
            </div>
            {draft.recurring && <>
              <fieldset className="space-y-2" aria-describedby={errors.days && reviewed ? "days-error" : undefined}>
                <legend className="mb-1 text-sm font-medium">Repeat Days and Start Times (WIB)</legend>
                {weekdays.map((day, index) => <div key={day} className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] items-center gap-3 border-b border-line pb-1 last:border-0">
                  <Toggle label={day} checked={index in draft.days} change={checked => {
                    const days = { ...draft.days };
                    if (checked) days[index] = draft.start || "07:00";
                    else delete days[index];
                    patch({ days });
                  }} />
                  {index in draft.days && <Input aria-label={`${day} start time`} type="time" value={draft.days[index]} onChange={e => patch({ days: { ...draft.days, [index]: e.target.value } })} />}
                </div>)}
                {error("days") && <div id="days-error" role="alert"><FieldError>{error("days")}</FieldError></div>}
              </fieldset>
              <div className={grid}>
                <Field name="ends-by" label="Recurring Schedule Ends By"><Select id="ends-by" value={draft.endsBy} onChange={e => patch({ endsBy: e.target.value as ClassDraft["endsBy"] })}>
                  <option value="count">Number of Occurrences</option><option value="date">End Date</option>
                </Select></Field>
                {draft.endsBy === "count" ? <Field name="count" label="Number of Occurrences" error={error("count")}>
                  <Input {...control("count")} type="number" min={1} max={maxSessions} value={draft.count || ""} onChange={e => patch({ count: e.target.valueAsNumber || 0 })} />
                </Field> : <Field name="endDate" label="End Date" error={error("endDate")}>
                  <Input {...control("endDate")} type="date" min={draft.date} value={draft.endDate} onChange={e => patch({ endDate: e.target.value })} />
                </Field>}
              </div>
            </>}
            <p className="text-xs text-ink-muted">Demo gym hours {operatingHours.start}–{operatingHours.end} WIB. Duration {draft.duration || "—"} minutes.</p>
            {errors.schedule && <div role="alert"><FieldError>{errors.schedule}</FieldError></div>}
          </Section>
          <Section title="Capacity & Booking">
            <div className={grid}>
              <Field name="capacity" label="Maximum Participants" error={error("capacity")}>
                <Input {...control("capacity")} type="number" min={1} value={draft.capacity || ""} onChange={e => patch({ capacity: e.target.valueAsNumber || 0 })} />
              </Field>
              {numberRule("minimum", "Minimum Participants (optional)")}
            </div>
            <Toggle label="Booking Required" checked={draft.rules.bookingRequired} change={checked => rule("bookingRequired", checked)} />
            {draft.rules.bookingRequired && <>
              <div className={grid}>
                {numberRule("opensMinutes", "Booking Opens Before Class (minutes)")}
                {numberRule("closesMinutes", "Booking Closes Before Class (minutes)")}
                <Field name="cancellationMinutes" label="Cancellation Deadline (minutes before class)" error={error("cancellationMinutes")}>
                  <Input {...control("cancellationMinutes")} type="number" min={0} value={Number.isNaN(draft.cancellationMinutes) ? "" : draft.cancellationMinutes} onChange={e => patch({ cancellationMinutes: e.target.valueAsNumber })} />
                </Field>
              </div>
              <Toggle label="Enable Waiting List" checked={draft.waitlist} change={waitlist => patch({ waitlist })} />
              {draft.waitlist && numberRule("waitlistLimit", "Maximum Waiting List")}
            </>}
          </Section>
          <Section title="Access & Pricing">
            <div className={grid}>
              <Field name="access" label="Class Access"><Select id="access" value={draft.rules.access} onChange={e => rule("access", e.target.value as ClassRules["access"])}>
                <option value="active">All Active Members</option><option value="packages">Selected Membership Packages</option><option value="walk-in">Members &amp; Walk-in Customers</option>
              </Select></Field>
              <Field name="pricing" label="Pricing Type"><Select id="pricing" value={draft.rules.paid ? "paid" : "included"} onChange={e => rule("paid", e.target.value === "paid")}>
                <option value="included">Included in Membership</option><option value="paid">Paid Class</option>
              </Select></Field>
              {draft.rules.paid && numberRule("memberPrice", "Member Price (IDR)")}
              {draft.rules.paid && draft.rules.access === "walk-in" && numberRule("walkInPrice", "Non-Member Price (IDR)")}
            </div>
            {draft.rules.access === "packages" && <fieldset>
              <legend className="text-sm font-medium">Membership Packages</legend>
              {packages.map(item => <Toggle key={item.id} label={item.name} checked={draft.rules.packages.includes(item.id)}
                change={checked => rule("packages", checked ? [...draft.rules.packages, item.id] : draft.rules.packages.filter(id => id !== item.id))} />)}
              {error("packages") && <div role="alert"><FieldError>{error("packages")}</FieldError></div>}
            </fieldset>}
          </Section>
          <Section title="Attendance Settings">
            <div className={grid}>
              <Toggle label="QR Check-in Enabled" checked={draft.rules.qr} change={checked => rule("qr", checked)} />
              <Toggle label="Manual Attendance" checked={draft.rules.manual} change={checked => rule("manual", checked)} />
              {(draft.rules.qr || draft.rules.manual) && <>
                {numberRule("checkInMinutes", "Check-in Opens Before Class (minutes)")}
                {numberRule("lateMinutes", "Late Check-in Tolerance (minutes)")}
              </>}
            </div>
          </Section>
          <Section title="Class Visibility">
            <Field name="visibility" label="Visibility"><Select id="visibility" value={draft.visibility} onChange={e => patch({ visibility: e.target.value as ClassDraft["visibility"] })}>
              <option value="draft">Draft</option><option value="published">Published</option>
            </Select></Field>
            <p className="text-sm text-ink-muted">{draft.visibility === "draft" ? "Draft sessions are visible to class managers." : "Published sessions appear in Member Classes."}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" disabled={imagePending} onClick={() => validateForSave("draft")}>Save as Draft</Button>
              <Button type="button" disabled={imagePending} onClick={() => validateForSave("published")}>Publish Class</Button>
            </div>
          </Section>
        </form>
      </Card>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-20">
        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-elevated">
            <Image src={draft.image || defaultCover} alt="" fill unoptimized sizes="(min-width:1280px) 400px, 100vw" className="object-cover" />
          </div>
          <div className="space-y-3 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-ink-muted">Class Preview</h2>
            <h3 className="break-words text-xl font-semibold">{draft.name.trim() || "Untitled Class"}</h3>
            <p className="text-sm text-ink-muted">{draft.category || "Category"} · {draft.difficulty}</p>
            <p className="text-sm">{trainer?.trainer.name || "Instructor pending"}</p>
            <p className="text-sm">{branch?.name || "Branch pending"}{draft.room && ` · ${draft.room}`} · {draft.duration || "—"} min</p>
            {firstSlot && <p className="text-sm">{classDate(firstSlot.startsAt)} · {firstSlot.start}–{firstSlot.end} WIB</p>}
            <p className="text-sm font-medium">{price}</p>
            {draft.description && <p className="line-clamp-3 break-words text-sm text-ink-muted">{draft.description}</p>}
          </div>
        </Card>
        <Card className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Booking Summary</h2>
            <Badge tone="neutral">{draft.visibility === "draft" ? "Draft" : !draft.rules.bookingRequired ? "Drop-in" : "Booking Required"}</Badge>
          </div>
          <p className="text-sm">0/{draft.capacity || "—"} participants · {slots.length} {slots.length === 1 ? "session" : "sessions"}</p>
          <p className="text-sm text-ink-muted">{draft.rules.bookingRequired && draft.waitlist ? `Waiting list · ${draft.rules.waitlistLimit || "—"} places` : "Waiting list disabled"}</p>
          {draft.rules.bookingRequired && <p className="text-xs text-ink-muted">Opens {draft.rules.opensMinutes || "—"} min before · Closes {draft.rules.closesMinutes || 0} min before</p>}
          {draft.rules.paid && draft.rules.access === "walk-in" && <p className="text-sm text-ink-muted">Walk-in {formatCurrency(draft.rules.walkInPrice || 0)}</p>}
          {slots.length > 0 && <details open className="border-t border-line pt-3 text-sm">
            <summary className="cursor-pointer font-medium">Schedule Preview</summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-auto pr-1">
              {slots.map(slot => <li key={slot.startsAt} className="flex flex-wrap justify-between gap-x-2 text-xs text-ink-muted"><span>{classDate(slot.startsAt)}</span><span>{slot.start}–{slot.end} WIB</span></li>)}
            </ul>
          </details>}
        </Card>
      </aside>
    </div>
    {confirm && <ConfirmDialog open title={confirm === "draft" ? "Save Class Draft?" : "Publish Class?"}
      description={`${draft.name.trim()} · ${slots.length} sessions · ${trainer?.trainer.name} · ${branch?.name}, ${draft.room} · ${draft.capacity} participants per session · ${price}. ${confirm === "draft" ? "Visible to class managers." : "Visible in Member Classes."}`}
      confirmLabel={confirm === "draft" ? "Save as Draft" : "Publish Class"} onConfirm={save} onClose={() => setConfirm(null)} />}
    {leave && <ConfirmDialog open title="Discard Unsaved Changes?" description="Your class setup will be cleared when you leave this page." destructive confirmLabel="Discard Changes"
      onClose={keepEditing} onConfirm={discard} />}
  </div>;
}
