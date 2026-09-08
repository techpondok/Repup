"use client";

import { useTransition } from "react";
import { switchDemoRole } from "@/app/actions/auth";
import type { DemoRole } from "@/lib/demo/roles";

const BUSINESS_ROLES: DemoRole[] = ["OWNER", "ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "STAFF", "COACH", "TRAINER", "MEMBER"];

export function DemoRoleSwitcher({ role, names }: { role: DemoRole; names: Record<DemoRole, string> }) {
  const [pending, startTransition] = useTransition();
  return <form action={(formData) => startTransition(() => switchDemoRole(formData))} className="flex items-center gap-1">
    <label htmlFor="demo-role" className="sr-only">Ganti peran</label>
    <select id="demo-role" name="role" defaultValue={role} disabled={pending} className="bg-transparent font-medium outline-none" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
      {BUSINESS_ROLES.map((item) => <option key={item} value={item}>{names[item]}</option>)}
    </select>
  </form>;
}
