"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin, ShieldCheck } from "lucide-react";
import { useClasses } from "@/components/member/classes/class-provider";
import { ClassBookingDialog, ClassCapacityIndicator, ClassFeedback, ClassNavigation, ClassStatusBadge, EmptyState } from "@/components/member/classes/class-components";
import { useMember } from "@/components/member/member-provider";
import { classAvailability, classDate, classEligible, classTime, isPublishedClass, type ClassDemo } from "@/lib/member/classes";
import { packages } from "@/lib/demo/member-management";
import { formatCurrency } from "@/lib/format";

type BookingAction = "book" | "cancel" | "join" | "leave" | "accept";
const prompts: Record<BookingAction, string> = {
  book: "Confirm your class", cancel: "Cancel your booking?", join: "Join waiting list?",
  leave: "Leave waiting list?", accept: "Accept this slot?",
};

export default function ClassDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, dispatch } = useClasses();
  const { membership } = useMember();
  const [dialog, setDialog] = useState<BookingAction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [walkIn, setWalkIn] = useState(false);
  const [scenario, setScenario] = useState<ClassDemo>("available");

  useEffect(() => {
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      dispatch({ type: "tick", classId: id, eligible: false, now: time });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [id, dispatch]);

  const item = state.schedules.find(schedule => schedule.id === id && isPublishedClass(schedule));
  if (!item) return <EmptyState title="Class not found" description="Choose a published session from the class schedule." />;

  const booking = state.bookings.find(entry => entry.classId === id && entry.status === "confirmed");
  const queue = state.waitlist.filter(entry => entry.classId === id);
  const entry = queue.find(entry => entry.member);
  const rules = item.rules;
  const effectiveWalkIn = entry?.walkIn ?? booking?.walkIn ?? walkIn;
  const startsAt = Date.parse(item.startsAt);
  const membershipValid = (time: number) => membership.status === "active" && Date.parse(membership.end) > Math.max(time, startsAt);
  const memberPackage = packages.find(plan => plan.name === membership.plan)?.id ?? (membership.plan === "Unlimited Monthly" ? "monthly" : undefined);
  const eligible = classEligible(item, membershipValid(now) && state.eligibilityOverride, memberPackage, effectiveWalkIn);
  const available = classAvailability(item, now);
  const blocked = ["Cancelled", "Booking Closed", "Booking Not Open"].includes(available);
  const cutoff = startsAt - now <= item.cancellationHours * 3600000;
  const bookingRequired = rules?.bookingRequired ?? true;
  const access = rules?.access === "walk-in" ? "Members & walk-in customers" : rules?.access === "packages"
    ? packages.filter(plan => rules.packages.includes(plan.id)).map(plan => plan.name).join(", ")
    : "Active membership required";
  const price = rules?.paid ? formatCurrency(effectiveWalkIn ? rules.walkInPrice : rules.memberPrice) :
    effectiveWalkIn ? "Free walk-in" : "Included in Membership";
  const status = available === "Cancelled" ? available : booking ? "Already Booked" : entry ? "On Waiting List" : available;
  const queueFull = queue.length >= (rules?.waitlistLimit ?? Infinity);

  return <div className="space-y-6">
    <ClassNavigation />
    <div className="relative h-56 overflow-hidden rounded-2xl bg-elevated sm:h-80">
      <Image src={item.image} alt="" fill unoptimized sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute bottom-6 left-6 right-6 text-white">
        <p className="mb-3 text-xs uppercase tracking-widest">{item.category} · {item.difficulty}</p>
        <h1 className="mp-title break-words">{item.name}</h1>
      </div>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <section className="mp-card">
          <div className="mb-5 flex flex-wrap justify-between gap-3"><h2>Class Details</h2><ClassStatusBadge status={status} /></div>
          {item.description && <p className="mp-muted break-words">{item.description}</p>}
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2"><CalendarDays size={17} />{classDate(item.startsAt)}</p>
            <p className="flex items-center gap-2"><Clock3 size={17} />{classTime(item.startsAt)} WIB · {item.duration} min</p>
            <p className="flex items-center gap-2"><MapPin size={17} />{item.branch} · {item.studio}</p>
            <p className="flex items-center gap-2"><ShieldCheck size={17} />{access}</p>
          </div>
        </section>
        <section className="mp-card">
          <h2>{item.coach}</h2>
          <p className="mp-muted mt-2">{item.coachBio}</p>
        </section>
        <section className="mp-card">
          <h2>Booking &amp; Attendance</h2>
          <ul className="mp-muted mt-4 space-y-2 text-sm">
            <li>{price}{rules?.paid ? " · Simulated payment" : ""}</li>
            {bookingRequired && <li>Cancel at least {Math.round(item.cancellationHours * 60)} minutes before class.</li>}
            {rules && <li>{[rules.qr && "Demo QR check-in", rules.manual && "Manual attendance"].filter(Boolean).join(" or ") || "Attendance check-in disabled"}
              {(rules.qr || rules.manual) && ` · Opens ${rules.checkInMinutes} min early · ${rules.lateMinutes} min late tolerance`}</li>}
          </ul>
        </section>
      </div>
      <aside className="space-y-5">
        <section className="mp-card space-y-4">
          <h2>Class Booking</h2><ClassCapacityIndicator item={item} />
          {rules?.access === "walk-in" && !booking && !entry && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={walkIn} onChange={event => setWalkIn(event.target.checked)} /> Preview as a walk-in customer
          </label>}
          {booking && <div className="space-y-2 rounded-lg border border-line p-4">
            <p className="font-semibold text-sm">Booking confirmed</p>
            <p className="mp-muted text-xs">Reference {booking.reference} · Attendance {booking.attendance}</p>
            <Link href="/member/classes/bookings" className="mp-button secondary mt-2">View Booking</Link>
          </div>}
          {entry && <div className="space-y-2 rounded-lg border border-line p-4">
            <h3>{entry.status === "offered" ? "Slot offered" : "On the waiting list"}</h3>
            <p className="mp-muted text-xs">{entry.status === "offered" && entry.offerExpiresAt ? `Offer expires at ${classTime(entry.offerExpiresAt)} WIB` : `Queue position #${queue.indexOf(entry) + 1}`}</p>
            {entry.status === "offered" && !blocked && <button className="mp-button" disabled={!eligible} onClick={() => setDialog("accept")}>Accept Slot Offer</button>}
          </div>}
          {!eligible && !booking && <p className="mp-muted text-sm">Your membership does not meet the access requirements for this class.</p>}
          {blocked && <p className="mp-muted text-sm">{available === "Cancelled" ? "The gym cancelled this class." : available === "Booking Not Open" ? "The booking window has not opened yet." : "The booking window has closed."}</p>}
          {!booking && !entry && bookingRequired && <button className="mp-button w-full" disabled={!eligible || blocked || available === "Fully Booked"} onClick={() => setDialog("book")}>Book Class</button>}
          {!bookingRequired && <p className="mp-muted text-sm">Drop-in class · No booking required.</p>}
          {!booking && !entry && bookingRequired && available === "Fully Booked" && item.waitlistEnabled && <button className="mp-button secondary w-full" disabled={!eligible || queueFull} onClick={() => setDialog("join")}>{queueFull ? "Waiting List Full" : "Join Waiting List"}</button>}
          {booking && <><button className="mp-button secondary w-full" disabled={cutoff || available === "Cancelled"} onClick={() => setDialog("cancel")}>Cancel Booking</button>
            {cutoff && <p className="mp-muted text-xs">Cancellation deadline passed.</p>}</>}
          {entry && <button className="mp-button secondary w-full" onClick={() => setDialog("leave")}>Leave Waiting List</button>}
          {entry?.status === "waiting" && !blocked && <button className="mp-button secondary w-full"
            onClick={() => dispatch({ type: "release", classId: id, eligible, now: Date.now() })}>Simulate Slot Opening</button>}
          <p className="mp-muted text-xs">Bookings and payments are simulated in this browser session.</p>
        </section>
        {process.env.NODE_ENV === "development" && <section className="mp-card">
          <label className="block text-sm">Development booking scenario
            <select className="mp-field mt-2" value={scenario} onChange={event => {
              const next = event.target.value as ClassDemo;
              setScenario(next);
              dispatch({ type: "demo", classId: id, scenario: next, now: Date.now() });
            }}>
              {Object.entries({ available: "Available", "almost-full": "Almost Full", full: "Fully Booked", booked: "Already Booked",
                waiting: "Waiting List", ineligible: "Not Eligible", closed: "Booking Closed", cancelled: "Cancelled" })
                .map(([key, label]) => <option value={key} key={key}>{label}</option>)}
            </select>
          </label>
        </section>}
      </aside>
    </div>
    <ClassFeedback message={state.feedbackClassId === id ? state.feedback : ""} success={state.success} />
    <ClassBookingDialog open={!!dialog} title={dialog ? prompts[dialog] : ""} onClose={() => setDialog(null)}
      description={`${item.name} · ${classDate(item.startsAt)} · ${classTime(item.startsAt)} WIB${dialog === "book" || dialog === "accept" ? ` · ${price}` : ""}`}
      onConfirm={() => {
        if (!dialog) return;
        const time = Date.now();
        dispatch({ type: dialog, classId: id, eligible: membershipValid(time), memberPackage, walkIn: effectiveWalkIn, now: time });
        setDialog(null);
      }} />
  </div>;
}
