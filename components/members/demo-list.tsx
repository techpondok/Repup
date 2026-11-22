"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Plus, Search, Upload } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { activeCount, current, daysLeft, exportCsv, packageFor, packages, phoneKey, plans, status, type Member } from "@/lib/demo/member-management";
import { FollowUpForm, MemberForm, RenewalForm } from "./demo-forms";
import { ImportMembers } from "./demo-import";
import { PlanDialog } from "./demo-plan";
import { useMemberDemo } from "./demo-provider";
import { useBranchDemo } from "@/components/branches/demo-provider";
import type { DemoScope } from "./demo-scope";
import { Avatar, dateLabel, dateTimeLabel, MemberTable, Stats, Status } from "./demo-ui";

const pageSize = 10;
const expirationGroups = ["Expiring in 7 Days", "Expiring Today", "Expired"];
const statuses = ["Active", "Expiring Soon", "Frozen", "Expired", "Scheduled", "No Membership"];
type Dialog = { type: "add" | "import" | "plan" | "limit" | "reset" } | { type: "edit" | "renew" | "follow"; member: Member };

export function DemoMemberList({ expiring = false, ...initialScope }: DemoScope & { expiring?: boolean }) {
  const branch = useBranchDemo();
  const scope = branch ? { ...initialScope, canEdit: initialScope.canEdit && !!branch.scopedIds.length, branchIds: branch.scopedIds, branchId: branch.scope?.id ?? branch.scopedIds[0] ?? "" } : initialScope;
  const demo = useMemberDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [packageId, setPackage] = useState("");
  const [sort, setSort] = useState(expiring ? "expiration" : "name");
  const [group, setGroup] = useState(expirationGroups[0]);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const close = () => setDialog(null);
  const saved = (text: string) => { setMessage(text); close(); };
  const limit = () => setDialog({ type: "limit" });

  const members = demo.members.filter(member => scope.branchIds.includes(member.branchId));
  const remaining = (member: Member) => current(member, demo.today) ? daysLeft(current(member, demo.today).end, demo.today) : Infinity;
  const expiringCount = members.filter(member => remaining(member) > 0 && remaining(member) <= 7).length;
  const active = members.filter(member => ["Active", "Expiring Soon"].includes(status(member, demo.today))).length;
  const orgActive = activeCount(demo.members, demo.today);
  const cap = plans[demo.plan].limit;
  const filtered = members.filter(member => {
    const matches = [member.name, member.id, member.phone, member.email].some(value => value.toLowerCase().includes(query.trim().toLowerCase()));
    if (!matches || (filter && status(member, demo.today) !== filter) || (packageId && current(member, demo.today)?.packageId !== packageId)) return false;
    if (!expiring) return true;
    const days = remaining(member);
    if (group === "Expired") return days < 0;
    if (group === "Expiring Today") return days === 0;
    return days > 0 && days <= 7;
  }).sort((a, b) => {
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    if (sort === "expiration") return (current(a, demo.today)?.end ?? "9999").localeCompare(current(b, demo.today)?.end ?? "9999");
    if (sort === "visit") return (Date.parse(b.visits[0]?.at ?? "") || 0) - (Date.parse(a.visits[0]?.at ?? "") || 0);
    return a.name.localeCompare(b.name);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePage = Math.min(page, pages);

  function download() {
    setExportError("");
    try {
      const url = URL.createObjectURL(new Blob(["\uFEFF", exportCsv(filtered, demo.today)], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `repup-members-${demo.today}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${filtered.length} members exported.`);
    } catch {
      setExportError("CSV download failed. Try Export Members again.");
    }
  }

  if (!scope.canView) return <EmptyState title="Member access unavailable" description="Switch to a demo role with member access." />;

  const rows = filtered.slice((visiblePage - 1) * pageSize, visiblePage * pageSize).map(member => {
    const membership = current(member, demo.today);
    const packageName = packageFor(membership?.packageId)?.name ?? "—";
    const memberLink = <Link href={`/members/${member.id}`} className="flex w-fit items-center gap-3 hover:text-primary">
      <Avatar name={member.name} photo={member.photo} /><span><strong className="block">{member.name}</strong><span className="text-xs text-ink-muted">{member.id}</span></span>
    </Link>;
    const whatsApp = `https://wa.me/${phoneKey(member.phone)}?text=${encodeURIComponent(`Hi ${member.name}, this is ${scope.staff} from your gym. Your ${packageName} membership ${remaining(member) < 0 ? "expired" : "expires"} on ${dateLabel(membership?.end)}. Can we help you renew?`)}`;
    const actions = <div className="flex flex-wrap gap-1">
      <LinkButton variant="ghost" size="sm" href={`/members/${member.id}`}>{expiring ? "View Member" : "View Detail"}</LinkButton>
      {scope.canEdit && <>
        {!expiring && <Button variant="ghost" size="sm" onClick={() => setDialog({ type: "edit", member })}>Edit</Button>}
        <Button variant="ghost" size="sm" onClick={() => setDialog({ type: "renew", member })}>Renew Membership</Button>
        {expiring && <Button variant="ghost" size="sm" onClick={() => setDialog({ type: "follow", member })}>Mark Follow-up</Button>}
        {expiring && <a href={whatsApp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg px-3 text-[13px] font-medium text-primary hover:bg-canvas">Contact via WhatsApp</a>}
      </>}
    </div>;
    const followUp = member.followUps[0];
    return { id: member.id, cells: [
      memberLink, member.phone, packageName, dateLabel(membership?.end),
      ...(expiring ? [
        remaining(member) < 0 ? `${-remaining(member)} days overdue` : remaining(member) === 0 ? "Today" : `${remaining(member)} days`,
        <div key="follow-up" className="space-y-1"><Status value={followUp?.status ?? "Not Contacted"} />{followUp && <p className="text-xs text-ink-muted">{followUp.staff}{followUp.next ? ` · Next ${dateLabel(followUp.next)}` : ""}</p>}</div>,
      ] : [dateTimeLabel(member.visits[0]?.at), <Status key="status" value={status(member, demo.today)} />]),
      actions,
    ] };
  });

  return <div className="mx-auto max-w-[1400px] space-y-4">
    <PageHeader title={expiring ? "Expiring Soon" : "Members"} description={expiring ? "Track expirations and member follow-ups." : "Manage gym members and memberships."}
      actions={expiring ? <LinkButton variant="secondary" href="/members">Back to Members</LinkButton> : <>
        <LinkButton variant="secondary" href="/members/expiring-soon">Expiring Soon</LinkButton>
        <Button variant="secondary" onClick={download} disabled={!filtered.length}><Download size={16} />Export Members</Button>
        {scope.canEdit && <><Button variant="secondary" onClick={() => setDialog({ type: "import" })}><Upload size={16} />Import Members</Button>
          <Button onClick={() => setDialog({ type: "add" })}><Plus size={16} />Add Member</Button></>}
      </>} />
    {!expiring && <>
      <Stats values={[["Total Members", members.length], ["Active Memberships", active], ["Expiring in 7 Days", expiringCount]]} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 rounded-lg border border-line bg-surface px-3 py-1 text-xs text-ink-muted">
        <span>Demo session · {demo.plan} plan · {orgActive} / {cap} active slots{orgActive >= cap ? " · Limit reached" : ""}</span>
        <div className="flex flex-wrap gap-1">
          {scope.canManagePlan && <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "plan" })}>View Demo Plan</Button>}
          {scope.canManagePlan && <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "reset" })}>Reset Member Demo</Button>}
        </div>
      </div>
    </>}
    {expiring && <div className="flex flex-wrap gap-1 border-b border-line pb-2" aria-label="Expiration groups">
      {expirationGroups.map(item => <Button key={item} size="sm" variant={group === item ? "secondary" : "ghost"} aria-pressed={group === item} onClick={() => { setGroup(item); setPage(1); }}>{item}</Button>)}
    </div>}
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_12rem_12rem]">
      <div className="relative"><Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <Input type="search" aria-label="Search members" placeholder="Search name, phone, email or ID" className="pl-9" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
      </div>
      {!expiring && <Select aria-label="Membership status" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map(item => <option key={item}>{item}</option>)}</Select>}
      <Select aria-label="Membership package" value={packageId} onChange={event => { setPackage(event.target.value); setPage(1); }}><option value="">All packages</option>{packages.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>
      <Select aria-label="Sort members" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="expiration">Earliest expiration</option><option value="visit">Latest visit</option></Select>
    </div>
    {message && <p role="status" className="rounded-lg bg-primary-tint px-4 py-3 text-sm text-ink">{message}</p>}
    {exportError && <p role="alert" className="text-sm text-danger">{exportError}</p>}
    <Card>
      <MemberTable headers={["Member", expiring ? "Contact" : "Phone Number", expiring ? "Package" : "Membership Package", "Expiration Date", ...(expiring ? ["Remaining Days", "Follow-up Status"] : ["Last Visit", "Status"]), "Actions"]} rows={rows} empty={expiring ? "No members match this expiration group" : "No members match your filters"} mobile />
      {filtered.length > 0 && <nav aria-label="Member pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-sm text-ink-muted">
        <span>{(visiblePage - 1) * pageSize + 1}–{Math.min(visiblePage * pageSize, filtered.length)} of {filtered.length} members</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Previous</Button>
          <Button variant="secondary" size="sm" disabled={visiblePage >= pages} onClick={() => setPage(visiblePage + 1)}>Next</Button>
        </div>
      </nav>}
    </Card>
    {dialog?.type === "add" && <MemberForm branchId={scope.branchId} close={close} saved={saved} limit={limit} />}
    {dialog?.type === "edit" && <MemberForm member={dialog.member} branchId={scope.branchId} close={close} saved={saved} limit={limit} />}
    {dialog?.type === "renew" && <RenewalForm member={dialog.member} close={close} saved={saved} limit={limit} />}
    {dialog?.type === "import" && <ImportMembers branchId={scope.branchId} close={close} saved={saved} />}
    {dialog?.type === "follow" && <FollowUpForm member={dialog.member} staff={scope.staff} close={close} saved={saved} />}
    {(dialog?.type === "plan" || dialog?.type === "limit") && <PlanDialog blocked={dialog.type === "limit"} canManage={scope.canManagePlan} close={close} saved={saved} />}
    {dialog?.type === "reset" && <ConfirmDialog open title="Reset Member Demo?" description="Clear member changes made in this session and restore the sample members and Free plan." confirmLabel="Reset Member Demo" onClose={close} onConfirm={() => { demo.reset(); saved("Member demo reset."); }} />}
  </div>;
}
