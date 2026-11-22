"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { demoStaff, employmentTypes, staffRoles, type DemoStaff } from "@/lib/demo/staff";

type StaffInput = Pick<DemoStaff, "name" | "email" | "position" | "employment" | "branch">;
const StaffContext = createContext<{ staff: DemoStaff[]; createStaff: (input: StaffInput) => string | undefined } | null>(null);

export function StaffDemoProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState(demoStaff);
  const current = useRef(staff);

  function createStaff(input: StaffInput) {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || !input.branch || !staffRoles.includes(input.position) || !employmentTypes.includes(input.employment)) return "Periksa nama, email, role, dan cabang.";
    if (current.current.some(item => item.email === email)) return "Email ini sudah digunakan oleh staff.";
    const code = "EMP-" + String(current.current.length + 1).padStart(3, "0");
    current.current = [...current.current, { ...input, id: "demo-staff-" + crypto.randomUUID(), name, email, code, weekdays: [1, 2, 3, 4, 5] }];
    setStaff(current.current);
  }

  return <StaffContext.Provider value={{ staff, createStaff }}>{children}</StaffContext.Provider>;
}

export function useStaffDemo() {
  const context = useContext(StaffContext);
  if (!context) throw new Error("StaffDemoProvider is required.");
  return context;
}
