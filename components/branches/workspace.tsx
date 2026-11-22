"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrainerDrawer } from "@/components/trainers/trainer-drawer";
import { useStaffDemo } from "@/components/staff/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/layout-bits";
import { availableStock } from "@/lib/store/model";
import { blankBranch, branchCost, branchError, days, facilities, type Branch } from "@/lib/demo/branches";
import { rupiah, subscriptionUrl } from "./billing";
import { useBranchDemo } from "./demo-provider";
import { useBranchMetrics } from "./metrics";

const pageSize = 8;
const tabs = ["Overview", "Members", "Staff & Trainers", "Classes & PT", "POS & Inventory", "Settings"];

function BranchForm({ initial, managers, save }: { initial: Branch; managers: { id: string; name: string }[]; save: (row: Branch) => void }) {
  const [value, setValue] = useState(initial);
  const input = (key: keyof Branch, label: string, type = "text", required = false) => <label className="text-sm">{label}<Input type={type} min={type === "number" ? 1 : undefined} required={required} value={String(value[key])} onChange={event => setValue({ ...value, [key]: type === "number" ? Number(event.target.value) : event.target.value })} /></label>;
  const choices = (key: "days" | "facilities", options: string[]) => options.map(option => <label className="flex items-center gap-2 text-sm" key={option}><input type="checkbox" checked={value[key].includes(option)} onChange={event => setValue({ ...value, [key]: event.target.checked ? [...value[key], option] : value[key].filter(item => item !== option) })} />{option}</label>);
  return <form className="space-y-5" onSubmit={event => { event.preventDefault(); save({ ...value, name: value.name.trim(), code: value.code.trim().toUpperCase(), email: value.email.trim(), phone: value.phone.trim() }); }}>
    <div className="grid gap-3 sm:grid-cols-2">
      {input("name", "Branch name", "text", true)}{input("code", "Branch code", "text", true)}{input("phone", "Phone", "tel")}{input("email", "Email", "email")}
      {input("address", "Address")}{input("city", "City")}{input("province", "Province")}{input("postal", "Postal code")}
      <label className="text-sm">Branch manager<Select value={value.manager} onChange={event => setValue({ ...value, manager: event.target.value })}><option value="">Unassigned</option>{managers.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</Select></label>
      <label className="text-sm">Status<Select value={value.status} onChange={event => setValue({ ...value, status: event.target.value as Branch["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></label>
      {input("opens", "Opening time", "time", true)}{input("closes", "Closing time", "time", true)}
      <label className="text-sm">Timezone<Select value={value.timezone} onChange={event => setValue({ ...value, timezone: event.target.value })}>{["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"].map(zone => <option key={zone}>{zone}</option>)}</Select></label>
      {input("capacity", "Capacity", "number", true)}
    </div>
    <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-medium">Operational days</legend>{choices("days", days)}</fieldset>
    <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-medium">Facilities</legend>{choices("facilities", facilities)}</fieldset>
    <Button type="submit">{initial.id ? "Save branch changes" : "Review new branch"}</Button>
  </form>;
}

export function BranchWorkspace({ detailId, initialTab }: { detailId?: string; initialTab?: string }) {
  const demo = useBranchDemo();
  if (!demo) return <><PageHeader title="Branch Management" /><EmptyState title="Branch preview is available in demo mode." /></>;
  return <BranchScreen key={detailId ?? "list"} demo={demo} detailId={detailId} initialTab={initialTab} />;
}

function BranchScreen({ demo, detailId, initialTab }: { demo: NonNullable<ReturnType<typeof useBranchDemo>>; detailId?: string; initialTab?: string }) {
  const router = useRouter();
  const { staff } = useStaffDemo();
  const { forBranch } = useBranchMetrics();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("Branch name");
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState(initialTab ?? "Overview");
  const [draft, setDraft] = useState<Branch | null>(null);
  const [review, setReview] = useState<Branch | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const visible = demo.allowed.filter(branch => !status || branch.status === status).filter(branch =>
    [branch.name, branch.code, branch.city].join(" ").toLowerCase().includes(search.trim().toLowerCase())).sort((left, right) =>
    sort === "Active members" ? forBranch(right.id).activeMembers - forBranch(left.id).activeMembers : left.name.localeCompare(right.name));
  const active = demo.active.map(branch => forBranch(branch.id));
  const branch = demo.allowed.find(item => item.id === detailId);
  const detail = branch ? forBranch(branch.id) : null;
  const managers = staff.filter(row => ["Branch Manager", "Admin"].includes(row.position));
  const nextCount = review ? demo.activeCount - Number(demo.branches.find(row => row.id === review.id)?.status === "active") + Number(review.status === "active") : demo.activeCount;

  function startAdd() {
    setError(""); setMessage("");
    if (!branchCost(demo.plan, demo.activeCount + 1).allowed) setUpgrade(true);
    else setDraft(blankBranch);
  }

  function apply(value: Branch) {
    const failure = demo.save(value);
    if (failure) { setError(failure); return; }
    setDraft(null); setReview(null); setError(""); setPage(0);
    setMessage(value.status === "inactive" ? "Branch saved as inactive. History is retained." : "Branch saved. Billing preview updated.");
  }

  function stage(value: Branch) {
    const failure = branchError(value, demo.branches);
    if (failure || (value.manager && !managers.some(row => row.id === value.manager))) {
      setError(failure ?? "Choose a staff member with the Branch Manager or Admin role."); return;
    }
    const previous = demo.branches.find(row => row.id === value.id);
    if (!branchCost(demo.plan, demo.activeCount - Number(previous?.status === "active") + Number(value.status === "active")).allowed) {
      setError("Upgrade to Starter in Branch Billing before activating a second branch."); return;
    }
    if (previous?.status !== value.status) { setError(""); setReview(value); }
    else apply(value);
  }

  function switchBranch(id: string) { demo.pick(id); router.push("/dashboard"); }
  function sum(key: "activeMembers" | "revenue") { return active.reduce((total, row) => total + row[key], 0); }

  if (detailId && (!branch || !detail)) return <EmptyState title="Branch unavailable" action={<LinkButton href="/branches">Back to Branch Management</LinkButton>} />;
  return <div className="space-y-5">
    <PageHeader title={branch?.name ?? "Branch Management"} description={branch ? [branch.code, branch.city, branch.province].filter(Boolean).join(" · ") : "Manage your gym locations and branch operations."}
      actions={<>
        {branch && <LinkButton href="/branches" variant="secondary">All branches</LinkButton>}
        {branch && demo.owner && <Button variant="secondary" onClick={() => { setError(""); setDraft(branch); }}>Edit Branch</Button>}
        {branch?.status === "active" && <Button onClick={() => switchBranch(branch.id)}>Switch to Branch</Button>}
        {!branch && demo.owner && <><LinkButton href={subscriptionUrl} variant="secondary">Branch Billing</LinkButton><Button onClick={startAdd}>Add Branch</Button></>}
      </>} />
    {message && <p role="status" className="rounded-md bg-primary-tint p-3 text-sm text-primary">{message}</p>}
    {error && !draft && <p role="alert" className="text-sm text-danger">{error}</p>}
    {branch && detail ? <>
      <Badge tone={branch.status === "active" ? "success" : "neutral"}>{branch.status === "active" ? "Active" : "Inactive"}</Badge>
      <div role="group" aria-label="Branch detail sections" className="flex flex-wrap gap-2">{tabs.map(item => <Button key={item} size="sm" variant={tab === item ? "primary" : "secondary"} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</Button>)}</div>
      {tab === "Overview" && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Active Members", detail.activeMembers], ["Monthly Revenue", rupiah(detail.revenue)], ["Monthly Check-ins", detail.checkins], ["Active Employees", detail.employees.length + detail.trainers.length]].map(([label, value]) => <StatCard key={label} label={String(label)} value={String(value)} />)}<p className="text-sm">Upcoming classes: {detail.schedules.length}</p></div>}
      {tab === "Members" && <Items items={detail.members.map(item => item.name + " · " + item.id)} empty="No members assigned to this branch." />}
      {tab === "Staff & Trainers" && <><Items items={[...detail.employees.map(item => item.name + " · " + item.position), ...detail.trainers.map(item => item.trainer.name + " · Trainer")]} empty="No employees assigned to this branch." /><LinkButton href={"/staff?branch=" + branch.id} variant="secondary">Manage Staff</LinkButton></>}
      {tab === "Classes & PT" && <Items items={[...detail.schedules.map(item => item.name + " · " + item.startsAt.slice(0, 10)), ...detail.sessions.map(item => item.memberName + " · PT · " + item.date + " " + item.start)]} empty="No upcoming classes or PT sessions." />}
      {tab === "POS & Inventory" && <><Items items={detail.orders.map(item => [item.id, item.cashierName, item.lines.map(line => line.name).join(", "), rupiah(item.total), item.paymentMethod, new Date(item.createdAt).toLocaleDateString("id-ID", { timeZone: branch.timezone })].filter(Boolean).join(" · "))} empty="No branch transactions." /><Items items={detail.products.map(item => item.name + " · " + availableStock(detail.store, item.id, branch.id) + " available")} empty="No inventory." /></>}
      {tab === "Settings" && <Items items={[[branch.address, branch.city, branch.province, branch.postal].filter(Boolean).join(", "), branch.phone, branch.email, branch.opens + "–" + branch.closes + " · " + branch.timezone, branch.days.join(", "), "Capacity " + branch.capacity, branch.facilities.join(", ")].filter(Boolean)} empty="No branch settings." />}
    </> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total Branches", demo.allowed.length], ["Active Branches", demo.active.length], ["Total Active Members", sum("activeMembers")], ["Total Monthly Revenue", rupiah(sum("revenue"))]].map(([label, value]) => <StatCard key={label} label={String(label)} value={String(value)} />)}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input aria-label="Search branches" placeholder="Search name, code, or city" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
        <Select aria-label="Filter by status" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
        <Select aria-label="Sort branches" value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option>Branch name</option><option>Active members</option></Select>
      </div>
      {visible.length ? <Card><DataTable className="w-full min-w-[940px] text-sm">
        <thead><tr className="border-b border-line text-left text-xs text-ink-faint">{["Branch Name", "Code", "Location", "Manager", "Active Members", "Employees", "Status", "Actions"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{visible.slice(page * pageSize, (page + 1) * pageSize).map(item => {
          const stats = forBranch(item.id);
          return <tr key={item.id} className="border-b border-line last:border-0">
            <td className="p-3 font-medium">{item.name}</td><td className="p-3">{item.code}</td><td className="p-3">{item.city || "—"}</td><td className="p-3">{staff.find(row => row.id === item.manager)?.name ?? "—"}</td>
            <td className="p-3">{stats.activeMembers}</td><td className="p-3">{stats.employees.length + stats.trainers.length}</td><td className="p-3"><Badge tone={item.status === "active" ? "success" : "neutral"}>{item.status === "active" ? "Active" : "Inactive"}</Badge></td>
            <td className="p-3"><div className="flex flex-wrap gap-1"><LinkButton href={"/branches/" + item.id} variant="ghost" size="sm">View Branch</LinkButton>
              {demo.owner && <><Button size="sm" variant="ghost" onClick={() => { setError(""); setDraft(item); }}>Edit Branch</Button><LinkButton href={"/branches/" + item.id + "?tab=staff"} variant="ghost" size="sm">Manage Staff</LinkButton></>}
              {item.status === "active" && <><Button size="sm" variant="ghost" onClick={() => switchBranch(item.id)}>Switch to Branch</Button>{demo.owner && <Button size="sm" variant="ghost" onClick={() => { setError(""); setReview({ ...item, status: "inactive" }); }}>Deactivate Branch</Button>}</>}
            </div></td>
          </tr>;
        })}</tbody>
      </DataTable><div className="flex justify-between p-3"><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="secondary" disabled={(page + 1) * pageSize >= visible.length} onClick={() => setPage(page + 1)}>Next</Button></div></Card> : <EmptyState title="No branches match your filters." />}
    </>}
    {draft && <TrainerDrawer title={draft.id ? "Edit Branch" : "Add Branch"} onClose={() => { setDraft(null); setReview(null); setError(""); }}>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}<BranchForm initial={draft} managers={managers} save={stage} />
      {review && <BranchConfirmation previous={demo.activeCount} count={nextCount} plan={demo.plan} row={review} details={forBranch(review.id)} close={() => setReview(null)} confirm={() => apply(review)} />}
    </TrainerDrawer>}
    {!draft && review && <BranchConfirmation previous={demo.activeCount} count={nextCount} plan={demo.plan} row={review} details={forBranch(review.id)} close={() => setReview(null)} confirm={() => apply(review)} />}
    <ConfirmDialog open={upgrade} title="Upgrade Required" description={"Free includes one active branch. Starter would cost " + rupiah(branchCost("Starter", demo.activeCount + 1).monthly) + " per month after adding this branch."} confirmLabel="Upgrade Plan" onClose={() => setUpgrade(false)} onConfirm={() => { if (demo.changePlan("Starter")) { setUpgrade(false); setDraft(blankBranch); setMessage("Upgraded to Starter in the simulation."); } }} />
  </div>;
}

function Items({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <Card><ul className="divide-y divide-line">{items.map((item, index) => <li key={index} className="p-3 text-sm">{item}</li>)}</ul></Card> : <EmptyState title={empty} />;
}

function BranchConfirmation({ previous, count, plan, row, details, close, confirm }: {
  previous: number; count: number; plan: "Free" | "Starter"; row: Branch; details: ReturnType<ReturnType<typeof useBranchMetrics>["forBranch"]>; close: () => void; confirm: () => void;
}) {
  const before = branchCost(plan, previous);
  const after = branchCost(plan, count);
  const inactive = !!row.id && row.status === "inactive";
  return <ConfirmDialog open title={inactive ? "Deactivate " + row.name : "Confirm Branch Change"} confirmLabel={inactive ? "Deactivate Branch" : row.id ? "Confirm Activation" : "Confirm Add Branch"} destructive={inactive} onClose={close} onConfirm={confirm}
    description={`Monthly billing: ${rupiah(before.monthly)} → ${rupiah(after.monthly)}. ${inactive ? `${details.activeMembers} active members, ${details.employees.length + details.trainers.length} employees, ${details.schedules.length + details.sessions.length} upcoming activities. Historical records and bookings stay in place.` : "Changes apply to the subscription preview."}`} />;
}
