"use client";

import { CalendarDays, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PtAssignment, PtBooking } from "@/lib/pt-bookings";
import { PTStatusBadge } from "./pt-ui";

const routes = [
  { href: "/member/pt", label: "Overview" },
  { href: "/member/pt/packages", label: "My packages" },
  { href: "/member/pt/sessions", label: "My sessions" },
];

export function LivePtHeader({ title, description }: { title: string; description: string }) {
  const path = usePathname();
  return <header className="space-y-3">
    <h1 className="mp-title">{title}</h1>
    <p className="mp-muted">{description}</p>
    <nav className="flex flex-wrap gap-2" aria-label="Personal training">
      {routes.map(item => <Link className="mp-button secondary" key={item.href} href={item.href}
        aria-current={path === item.href ? "page" : undefined}>{item.label}</Link>)}
    </nav>
  </header>;
}

export function LivePtError({ message }: { message: string }) {
  const router = useRouter();
  return <div className="mp-card space-y-3">
    <p role="alert" className="text-sm text-danger">{message}</p>
    <button type="button" className="mp-button secondary" onClick={() => router.refresh()}>Retry</button>
  </div>;
}

export const ptStatusLabel = (value: string) => value.split(/[_ -]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
export const openPtBooking = (status: string) => ["pending_approval", "pending", "confirmed", "scheduled"].includes(status);

export function gymDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone || "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}

export function ptDisplayDate(date: string | null | undefined) {
  if (!date) return "—";
  const value = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}

export function ptDisplayTimestamp(timestamp: string, timezone: string) {
  const value = new Date(timestamp);
  return Number.isNaN(value.getTime()) ? timestamp : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: timezone,
  }).format(value);
}

export function ptEndTime(start: string, duration: number) {
  const [hours, minutes] = start.split(":").map(Number);
  const total = (hours * 60 + minutes + duration) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function PtAssignmentTrainer({ assignment }: { assignment: PtAssignment }) {
  return <div className="flex flex-wrap items-center gap-3">
    {assignment.trainerPhoto ? (
      // Trainer uploads are validated by the server.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={assignment.trainerPhoto} alt={`Profile photo of ${assignment.trainerName}`} className="size-12 shrink-0 rounded-full border border-line object-cover" />
    ) : <span className="mp-avatar"><UserRound size={21} aria-hidden="true" /></span>}
    <div className="min-w-0 flex-1">
      <strong className="break-words">{assignment.trainerName || "Trainer assignment pending"}</strong>
      <p className="mp-muted !text-xs">{[assignment.trainerSpecialty, assignment.trainerExperience ? `${assignment.trainerExperience} years coaching` : ""].filter(Boolean).join(" · ")}</p>
    </div>
    {assignment.trainerStatus && <PTStatusBadge>{ptStatusLabel(assignment.trainerStatus)}</PTStatusBadge>}
  </div>;
}

export function LivePtBookingCard({ booking }: { booking: PtBooking }) {
  return <article className="mp-card space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2>{booking.trainerName}</h2><p className="mp-muted mt-1">{booking.packageName}</p></div>
      <PTStatusBadge>{ptStatusLabel(booking.status)}</PTStatusBadge>
    </div>
    <p className="flex items-center gap-2 text-sm"><CalendarDays className="shrink-0" size={16} aria-hidden="true" />
      {ptDisplayDate(booking.date)} · {booking.start}–{booking.end}
    </p>
    <p className="mp-muted text-xs">{booking.reference}</p>
    <Link href={`/member/pt/sessions/${booking.id}`} className="mp-button secondary">Booking detail</Link>
  </article>;
}

export function PtPackageSummary({ assignment }: { assignment: PtAssignment }) {
  return <section className="mp-card space-y-4">
    <div><h2>{assignment.packageName}</h2><p className="mp-muted mt-1">{assignment.expiresOn ? `Expires ${ptDisplayDate(assignment.expiresOn)}` : "No expiry date"} · {assignment.duration} minutes per session</p></div>
    <dl className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
      {[["Total", assignment.total], ["Completed", assignment.completed], ["Reserved", assignment.reserved], ["Available", assignment.available]].map(([label, value]) =>
        <div key={label}><dt className="mp-muted !text-xs">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>,
      )}
    </dl>
  </section>;
}
