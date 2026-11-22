"use client";

import { Button } from "@/components/ui/button";
import { TrainerDrawer } from "@/components/trainers/trainer-drawer";
import { activeCount, plans } from "@/lib/demo/member-management";
import { useMemberDemo } from "./demo-provider";
import type { Save } from "./demo-forms";

export function PlanDialog({ blocked, canManage, close, saved }: { blocked: boolean; canManage: boolean; close: () => void; saved: Save }) {
  const demo = useMemberDemo();
  return <TrainerDrawer title={blocked ? "Active Member Limit Reached" : "Demo Subscription"} onClose={close} centered>
    <div className="space-y-4 text-sm">
      {blocked && <p role="alert">The {demo.plan} plan allows {plans[demo.plan].limit} active memberships. Existing members are preserved. {canManage && demo.plan === "Free" ? "Switch to Growth to activate more members." : "Free a slot before activating another membership."}</p>}
      <dl className="space-y-3">
        {Object.entries(plans).map(([name, plan]) => <div key={name} className="rounded-lg border border-line p-3">
          <dt className="font-semibold">{name}{demo.plan === name ? " · Current plan" : ""}</dt>
          <dd className="mt-1 text-ink-muted">{plan.limit} active members · {plan.features}</dd>
        </div>)}
      </dl>
      <p className="text-ink-muted">Simulated plan changes apply for this session. No billing is performed.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={close}>Close</Button>
        {canManage && demo.plan === "Free" && <Button onClick={() => { demo.setPlan("Growth"); saved("Growth plan enabled for this session."); }}>Simulate Upgrade</Button>}
        {canManage && !blocked && activeCount(demo.members, demo.today) < plans[demo.plan].limit &&
          <Button variant="secondary" onClick={() => { demo.fillLimit(); saved("Sample members added to reach the plan limit."); }}>Fill Demo Capacity</Button>}
      </div>
    </div>
  </TrainerDrawer>;
}
