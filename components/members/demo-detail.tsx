"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/layout-bits";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TrainerDrawer } from "@/components/trainers/trainer-drawer";
import { DemoPurchaseHistory } from "@/components/members/purchase-history";
import { useStore } from "@/components/store/store-provider";
import { demoQRDataURL } from "@/lib/member/qr";
import { formatCurrency } from "@/lib/format";
import { activity, current, daysLeft, packageFor, status, type Activity, type Member } from "@/lib/demo/member-management";
import { Field, FollowUpForm, Footer, MemberForm, RenewalForm } from "./demo-forms";
import { PlanDialog } from "./demo-plan";
import { useMemberDemo } from "./demo-provider";
import type { DemoScope } from "./demo-scope";
import { Avatar, dateLabel, dateTimeLabel, Facts, MemberTable, Status, timeLabel } from "./demo-ui";
import { Textarea } from "@/components/ui/field";
import { ptPackages, trainers } from "@/lib/member/pt";

const tabs = [
  ["overview", "Overview"], ["membership", "Membership"], ["attendance", "Attendance"],
  ["purchases", "Purchases"], ["personal-training", "Personal Training"], ["activity", "Activity"],
];
const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" });
const section = "mb-4 text-base font-semibold";
type Dialog = "edit" | "renew" | "change" | "freeze" | "unfreeze" | "limit" | "follow" | "trainer" | null;

export function DemoMemberDetail({ id, requestedTab, ...scope }: DemoScope & { id: string; requestedTab?: string }) {
  const demo = useMemberDemo();
  const { state: store } = useStore();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState("");
  const [trainerError, setTrainerError] = useState("");
  const tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : "overview";
  const member = demo.members.find(item => item.id === id && scope.branchIds.includes(item.branchId));
  if (!scope.canView || !member) return <EmptyState title="Member unavailable" description="This demo member may be outside your workspace or the demo session may have ended." action={<LinkButton href="/members" variant="secondary">Back to Members</LinkButton>} />;

  const membership = current(member, demo.today);
  const memberStatus = status(member, demo.today);
  const packageName = packageFor(membership?.packageId)?.name ?? "No Membership";
  const latestVisit = member.visits[0];
  const openVisit = latestVisit && !latestVisit.out;
  const monthlyVisits = member.visits.filter(visit => dateKey.format(new Date(visit.at)).slice(0, 7) === demo.today.slice(0, 7)).length;
  const trainer = trainers.find(item => item.id === member.pt?.trainerId);
  const ptPlan = ptPackages.find(item => item.id === member.pt?.packageId);
  const hasPT = trainer && ptPlan;
  const ptSessions = member.pt?.bookings ?? [];
  const completed = ptSessions.filter(item => item.status === "Completed").length;
  const reserved = ptSessions.filter(item => item.status === "Reserved").length;
  const available = ptPlan ? ptPlan.sessions - completed - reserved : 0;
  const activities: Activity[] = [
    ...member.activities,
    ...store.orders.filter(order => order.memberId === id && scope.branchIds.includes(order.branchId) && (order.paymentStatus === "paid" || order.paymentStatus === "refunded"))
      .map(order => ({ id: order.id, type: "POS Purchase", description: `${order.id} · ${formatCurrency(order.total)}`, at: new Date(order.paidAt ?? order.createdAt).toISOString() })),
    ...ptSessions.map(item => ({ id: item.id, type: "PT Booking", description: `${item.id} · ${trainer?.name ?? ""}`, at: item.createdAt })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const close = () => setDialog(null);
  const saved = (text: string) => { setMessage(text); close(); };
  const limit = () => setDialog("limit");
  function mutate(change: (item: Member) => Member) {
    return demo.update(items => items.map(item => item.id === id ? change(item) : item));
  }
  function checkIn() {
    let feedback = "";
    mutate(item => {
      if (item.visits[0] && !item.visits[0].out) { feedback = "Check out the current visit first."; return item; }
      if (!["Active", "Expiring Soon"].includes(status(item, demo.today))) { feedback = "An active membership is required for check-in."; return item; }
      const at = new Date().toISOString();
      return activity({ ...item, visits: [{ id: crypto.randomUUID(), at }, ...item.visits] }, "Check-in", "Simulated member QR check-in", at);
    });
    setMessage(feedback || "Check-in recorded.");
  }
  function checkOut() {
    mutate(item => !item.visits[0] || item.visits[0].out ? item : {
      ...item, visits: [{ ...item.visits[0], out: new Date().toISOString() }, ...item.visits.slice(1)],
    });
    setMessage("Check-out recorded.");
  }
  function toggleFreeze() {
    const frozen = dialog === "freeze";
    const result = mutate(item => {
      const first = current(item, demo.today);
      if (!first) return item;
      return activity({ ...item, memberships: item.memberships.map(entry => entry.id === first.id ? { ...entry, frozen } : entry) }, frozen ? "Membership Frozen" : "Membership Unfrozen", packageFor(first.packageId)!.name);
    });
    if (result === "limit") return limit();
    saved(frozen ? "Membership frozen. The expiry date still applies." : "Membership unfrozen.");
  }
  function requestTrainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const notes = String(new FormData(event.currentTarget).get("notes") ?? "").trim();
    if (!notes) { setTrainerError("Enter a reason for the trainer change."); return; }
    mutate(item => activity(item, "Trainer Change Requested", notes));
    saved("Trainer change request recorded in this demo session.");
  }

  const checkInButton = (label: string) => scope.canCheckIn && <Button variant="secondary" onClick={openVisit ? checkOut : checkIn}><ScanLine size={16} />{openVisit ? "Check-out" : label}</Button>;
  const activityTable = (items: Activity[]) => <MemberTable headers={["Activity Type", "Description", "Date & Time"]}
    rows={items.map(item => ({ id: item.id, cells: [item.type, item.description, dateTimeLabel(item.at)] }))} empty="No member activity yet" />;

  return <div className="mx-auto max-w-[1400px] space-y-4">
    <Link href="/members" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-ink-muted hover:text-primary"><ArrowLeft size={16} />Members</Link>
    <Card className="flex flex-wrap items-center justify-between gap-5 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar large name={member.name} photo={member.photo} />
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold tracking-tight">{member.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">{member.id} · {member.phone}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Status value={memberStatus} /><span className="text-xs text-ink-muted">Joined {dateLabel(member.joined)}</span></div>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {scope.canEdit && <Button onClick={() => setDialog("renew")}>Renew Membership</Button>}
        {scope.canEdit && <Button variant="secondary" onClick={() => setDialog("edit")}>Edit Member</Button>}
        {checkInButton("Check-in")}
        {(scope.canEdit || scope.canUsePOS) && <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-line-strong px-3 text-sm font-medium hover:bg-canvas">More Actions</summary>
          <div className="absolute left-0 z-10 mt-1 w-max rounded-lg border border-line bg-surface p-1 shadow-lg sm:right-0 sm:left-auto">
            {scope.canEdit && <Button variant="ghost" onClick={event => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setDialog("follow");
            }}>Add Follow-up</Button>}
            {scope.canUsePOS && <LinkButton href={`/pos?member=${id}`} variant="ghost">Create POS Transaction</LinkButton>}
          </div>
        </details>}
      </div>
    </Card>
    <nav className="flex flex-wrap gap-x-4 border-b border-line" aria-label="Member detail">
      {tabs.map(([key, label]) => <Link key={key} href={`/members/${id}?tab=${key}`} scroll={false} aria-current={tab === key ? "page" : undefined}
        className={`inline-flex min-h-11 items-center border-b-2 text-sm ${tab === key ? "border-primary font-semibold text-primary" : "border-transparent text-ink-muted hover:text-ink"}`}>{label}</Link>)}
    </nav>
    {message && <p role="status" className="rounded-lg bg-primary-tint px-4 py-3 text-sm">{message}</p>}
    {tab === "overview" && <>
      <Card className="p-5"><h2 className={section}>Member Overview</h2><Facts values={[
        ["Current Membership", packageName], ["Expiration Date", dateLabel(membership?.end)],
        ["Remaining Days", membership ? Math.max(0, daysLeft(membership.end, demo.today)) : "—"],
        ["Visits This Month", monthlyVisits], ["Last Check-in", dateTimeLabel(latestVisit?.at)],
        ["Assigned Personal Trainer", trainer ? trainer.name : "—"], ["Remaining PT Sessions", hasPT ? available : "—"],
        ["Email", member.email || "—"], ["Date of Birth", dateLabel(member.birth)], ["Gender", member.gender || "—"],
        ["Address", member.address || "—"], ["Emergency Contact", member.emergency || "—"],
      ]} /></Card>
      <Card><h2 className="px-5 pt-4 font-semibold">Recent Activity</h2>{activityTable(activities.slice(0, 5))}</Card>
    </>}
    {tab === "membership" && <>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Current Membership</h2>
        {membership ? <Facts values={[
          ["Current Package", packageName], ["Membership Status", <Status key="membership-status" value={memberStatus} />],
          ["Start Date", dateLabel(membership.start)], ["End Date", dateLabel(membership.end)],
          ["Membership Duration", `${daysLeft(membership.end, membership.start) + 1} days`],
          ["Price", formatCurrency(membership.price)], ["Payment Status", `Paid · ${membership.method}`],
        ]} /> : <p className="text-sm text-ink-muted">No membership assigned.</p>}
        {scope.canEdit && <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog("renew")}>Renew Membership</Button>
          {membership && <Button variant="secondary" onClick={() => setDialog("change")}>Change Package</Button>}
          {membership && memberStatus !== "Expired" && <Button variant="secondary" onClick={() => setDialog(membership.frozen ? "unfreeze" : "freeze")}>{membership.frozen ? "Unfreeze Membership" : "Freeze Membership"}</Button>}
        </div>}
      </Card>
      <Card><h2 className="px-5 pt-4 font-semibold">Membership History</h2><MemberTable headers={["Package", "Start Date", "End Date", "Price", "Payment Method"]}
        rows={member.memberships.map(item => ({ id: item.id, cells: [packageFor(item.packageId)?.name, dateLabel(item.start), dateLabel(item.end), formatCurrency(item.price), item.method] }))} empty="No membership history" /></Card>
    </>}
    {tab === "attendance" && <>
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <Image src={demoQRDataURL(`member-demo:${member.id}`)} alt="Demo member QR code" width={106} height={106} unoptimized className="rounded-md" />
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="font-semibold">Member QR Code</h2>
          <p className="text-xs text-ink-muted">Demo QR for simulated gym visits.</p>
          <Facts values={[["Total Visits", member.visits.length], ["Visits This Month", monthlyVisits], ["Last Check-in", dateTimeLabel(latestVisit?.at)]]} />
          {checkInButton("Simulate Check-in")}
        </div>
      </Card>
      <Card><h2 className="px-5 pt-4 font-semibold">Attendance History</h2><MemberTable headers={["Date", "Check-in Time", "Check-out Time", "Method", "Status"]}
        rows={member.visits.map(item => ({ id: item.id, cells: [dateLabel(item.at), timeLabel(item.at), timeLabel(item.out), item.id.startsWith("visit-") ? "Front Desk" : "Demo QR", item.out ? "Completed" : "Checked In"] }))} empty="No check-ins yet" /></Card>
    </>}
    {tab === "purchases" && <DemoPurchaseHistory memberId={id} branchIds={scope.branchIds} />}
    {tab === "personal-training" && (trainer && ptPlan ? <>
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar name={trainer.name} photo={trainer.image} />
          <div><p className="text-xs text-ink-muted">Assigned Trainer · Fixed Trainer</p><h2 className="font-semibold">{trainer.name}</h2><p className="text-sm text-ink-muted">{trainer.specialty}</p></div>
        </div>
        <Facts values={[["Active PT Package", ptPlan.name], ["Total Sessions", ptPlan.sessions], ["Completed Sessions", completed], ["Reserved Sessions", reserved], ["Available Sessions", available]]} />
        <div className="flex flex-wrap gap-2">
          {scope.canViewPT && <LinkButton variant="secondary" href={`/pt-clients?view=calendar&member=${id}`}>View Schedule</LinkButton>}
          {scope.canViewPT && <LinkButton variant="secondary" href={`/pt-clients?view=bookings&member=${id}`}>Manage Booking</LinkButton>}
          {scope.canEdit && <Button variant="secondary" onClick={() => { setTrainerError(""); setDialog("trainer"); }}>Request Change Trainer</Button>}
        </div>
      </Card>
      {(["Upcoming Sessions", "PT Booking History"] as const).map(title => {
        const rows = title === "Upcoming Sessions" ? ptSessions.filter(item => item.status === "Reserved" && Date.parse(item.at) > Date.now()) : ptSessions;
        return <Card key={title}><h2 className="px-5 pt-4 font-semibold">{title}</h2><MemberTable headers={["Booking", "Date & Time", "Trainer", "Status"]}
          rows={rows.map(item => ({ id: item.id, cells: [item.id, dateTimeLabel(item.at), trainer.name, item.status] }))} empty="No sessions" /></Card>;
      })}
    </> : <EmptyState title="No personal trainer assigned" description="This member has no active PT package." />)}
    {tab === "activity" && <Card><h2 className="px-5 pt-4 font-semibold">Member Activity</h2>{activityTable(activities)}</Card>}
    {dialog === "edit" && <MemberForm member={member} branchId={member.branchId} close={close} saved={saved} limit={limit} />}
    {(dialog === "renew" || dialog === "change") && <RenewalForm member={member} changePackage={dialog === "change"} close={close} saved={saved} limit={limit} />}
    {(dialog === "freeze" || dialog === "unfreeze") && <ConfirmDialog open title={dialog === "freeze" ? "Freeze Membership?" : "Unfreeze Membership?"}
      description={dialog === "freeze" ? "Pause demo check-in access. The expiration date still applies." : "Restore check-in access through the current expiration date."}
      confirmLabel={dialog === "freeze" ? "Freeze Membership" : "Unfreeze Membership"} onClose={close} onConfirm={toggleFreeze} />}
    {dialog === "limit" && <PlanDialog blocked canManage={scope.canManagePlan} close={close} saved={saved} />}
    {dialog === "follow" && <FollowUpForm member={member} staff={scope.staff} close={close} saved={saved} />}
    {dialog === "trainer" && trainer && <TrainerDrawer title="Request Change Trainer" onClose={close} centered>
      <form className="space-y-4" onSubmit={requestTrainer}>
        <p className="text-sm text-ink-muted">Current trainer is {trainer.name}. The request will appear in Activity.</p>
        <Field label="Reason for change"><Textarea name="notes" rows={3} required maxLength={800} /></Field>
        {trainerError && <p role="alert" className="text-sm text-danger">{trainerError}</p>}
        <Footer close={close} label="Record Request" />
      </form>
    </TrainerDrawer>}
  </div>;
}
