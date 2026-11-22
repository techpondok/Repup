"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { branchCost, branchError, demoBranches, type Branch, type Plan } from "@/lib/demo/branches";

const Context = createContext<ReturnType<typeof useBranchState> | null>(null);

function useBranchState(role: string, assigned: string[]) {
  const [branches, setBranches] = useState(demoBranches);
  const [plan, setPlan] = useState<Plan>("Starter");
  const [selected, setSelected] = useState("");
  const owner = role === "OWNER";
  const allowed = owner || role === "ADMIN" ? branches : branches.filter(branch =>
    role === "MANAGER" ? branch.manager === "demo-staff-manager" : assigned.includes(branch.id));
  const active = allowed.filter(branch => branch.status === "active");
  const scope = active.find(branch => branch.id === selected) ?? (owner ? null : active[0] ?? null);
  const scopedIds = scope ? [scope.id] : active.map(branch => branch.id);
  const activeCount = branches.filter(branch => branch.status === "active").length;

  function pick(id: string) {
    if ((!id && owner) || active.some(branch => branch.id === id)) setSelected(id);
  }

  function save(value: Branch) {
    if (!owner) return "Owner access required.";
    const error = branchError(value, branches);
    if (error) return error;
    const previous = branches.find(branch => branch.id === value.id);
    if (value.id && !previous) return "Branch is unavailable.";
    if (!branchCost(plan, activeCount - Number(previous?.status === "active") + Number(value.status === "active")).allowed) return "Upgrade to Starter to activate another branch.";
    const row = { ...value, id: value.id || "demo-location-" + crypto.randomUUID() };
    setBranches(current => previous ? current.map(branch => branch.id === row.id ? row : branch) : [...current, row]);
    if (row.status === "inactive" && selected === row.id) setSelected("");
  }

  function changePlan(next: Plan) {
    if (!owner || !branchCost(next, activeCount).allowed) return false;
    setPlan(next);
    return true;
  }

  return { branches, allowed, active, activeCount, scope, scopedIds, owner, role, plan, pick, save, changePlan };
}

export function BranchDemoProvider({ role, assigned, children }: { role: string; assigned: string[]; children: ReactNode }) {
  return <Context.Provider value={useBranchState(role, assigned)}>{children}</Context.Provider>;
}

export function useBranchDemo() {
  return useContext(Context);
}
