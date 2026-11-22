"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, SectionLabel } from "@/components/ui/layout-bits";
import { formatCurrency } from "@/lib/format";
import { branchCost, branchPricing, type Plan } from "@/lib/demo/branches";
import { plans as memberPlans } from "@/lib/demo/member-management";
import { useBranchDemo } from "./demo-provider";

export const rupiah = (amount: number) => formatCurrency(amount, "IDR");
export const subscriptionUrl = "/dashboard/settings/subscription";

export function BillingBreakdown({ plan, count, yearly = false }: { plan: Plan; count: number; yearly?: boolean }) {
  const cost = branchCost(plan, count);
  const items = { "Current plan": plan, "Active branches": count, "Base plan price": rupiah(cost.base), "Included branches": cost.included,
    "Additional branches": cost.extraCount, "Price per additional branch": rupiah(cost.extra), "Additional branch charge": rupiah(cost.fees),
    "Monthly total": rupiah(cost.monthly), "Yearly total": rupiah(cost.yearly) };
  return <><dl className="space-y-2 text-sm">{Object.entries(items).map(([label, value]) => <div key={label} className="flex justify-between gap-3">
    <dt className="text-ink-muted">{label}</dt><dd className="font-medium">{value}</dd>
  </div>)}</dl>
    <p className="mt-3 border-t border-line pt-3 font-semibold">{!cost.allowed ? "Free supports one active branch." : rupiah(yearly ? cost.yearly : cost.monthly) + (yearly ? " / year" : " / month")}</p></>;
}

export function SubscriptionWorkspace() {
  const demo = useBranchDemo();
  const [plan, setPlan] = useState<Plan>("Starter");
  const [count, setCount] = useState(String(demo?.activeCount ?? 1));
  const [cycle, setCycle] = useState("Monthly");
  const [notice, setNotice] = useState("");
  if (!demo?.owner) return <><PageHeader title="Subscription" /><EmptyState title="Branch billing is available to the demo owner." /></>;
  const nextBill = new Date();
  const nextBillingDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(nextBill.getFullYear(), nextBill.getMonth() + 1, 1));
  return <div className="space-y-5">
    <PageHeader title="Subscription" description="One subscription for all active branches in your organization." actions={<LinkButton href="/branches" variant="secondary">Branch Management</LinkButton>} />
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5"><SectionLabel>Branch Billing</SectionLabel><BillingBreakdown plan={demo.plan} count={demo.activeCount} />
        <p className="mt-3 text-sm text-ink-muted">Next billing date · {nextBillingDate} · simulation</p>
        <p className="mt-2 text-sm text-ink-muted">{demo.plan === "Free" ? `Free includes ${branchPricing.Free.memberLimit} active members and ${branchPricing.Free.staffLimit} staff accounts per organization.` : `Starter preview keeps RepUp’s existing ${memberPlans.Growth.limit}-member Growth limit per organization. Adding a branch does not increase the quota.`}</p>
        <div className="mt-4 flex flex-wrap gap-2">{(Object.keys(branchPricing) as Plan[]).filter(item => item !== demo.plan).map(item => <Button key={item} variant="secondary" disabled={!branchCost(item, demo.activeCount).allowed} onClick={() => {
          if (demo.changePlan(item)) setNotice(item + " plan applied in the simulation.");
        }}>Switch to {item}</Button>)}</div>
        {!branchCost("Free", demo.activeCount).allowed && <p className="mt-2 text-xs text-ink-muted">Reduce active branches to one before switching to Free.</p>}
      </Card>
      <Card className="space-y-4 p-5"><SectionLabel>Branch Cost Calculator</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Plan<Select value={plan} onChange={event => setPlan(event.target.value as Plan)}><option>Starter</option><option>Free</option></Select></label>
          <label className="text-sm">Active branches<Input type="number" min={1} max={999} step={1} value={count} onChange={event => setCount(event.target.value)} /></label>
          <label className="text-sm">Billing cycle<Select value={cycle} onChange={event => setCycle(event.target.value)}><option>Monthly</option><option>Yearly</option></Select></label>
        </div>
        {Number.isInteger(Number(count)) && Number(count) >= 1 && Number(count) <= 999
          ? <BillingBreakdown plan={plan} count={Number(count)} yearly={cycle === "Yearly"} />
          : <p role="alert" className="text-sm text-danger">Enter a whole number from 1 to 999.</p>}
      </Card>
    </div>
    <p className="text-sm text-ink-muted">Frontend simulation. Changes update the preview immediately. Real billing would follow the billing cycle and proration policy.</p>
  </div>;
}
