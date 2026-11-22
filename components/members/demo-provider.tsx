"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { activeCount, day, plans, seedMembers, type Member } from "@/lib/demo/member-management";

type Plan = keyof typeof plans;
type Result = "saved" | "limit";
type Demo = {
  today: string;
  members: Member[];
  plan: Plan;
  update: (change: (members: Member[]) => Member[]) => Result;
  setPlan: (plan: Plan) => void;
  reset: () => void;
  fillLimit: () => void;
};
const Context = createContext<Demo | null>(null);

export function MemberDemoProvider({ children, initialDay }: { children: ReactNode; initialDay: string }) {
  const [today, setToday] = useState(initialDay);
  const [members, setMembers] = useState(() => seedMembers(initialDay));
  const [plan, setPlan] = useState<Plan>("Free");
  const latest = useRef(members);
  useEffect(() => {
    const refreshDay = () => setToday(day());
    const timer = window.setInterval(refreshDay, 30_000);
    window.addEventListener("focus", refreshDay);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshDay); };
  }, []);

  function replace(next: Member[]) {
    latest.current = next;
    setMembers(next);
  }

  function update(change: (members: Member[]) => Member[]): Result {
    const date = day();
    const before = activeCount(latest.current, date);
    const next = change(latest.current);
    const after = activeCount(next, date);
    if (after > plans[plan].limit && after > before) return "limit";
    replace(next);
    return "saved";
  }

  function fillLimit() {
    const template = seedMembers(today)[0];
    const amount = Math.max(0, plans[plan].limit - activeCount(latest.current, today));
    const added = Array.from({ length: amount }, (_, index): Member => ({
      ...template, id: `RPU-LIMIT-${crypto.randomUUID().slice(0, 8)}`,
      name: `Demo Member ${latest.current.length + index + 1}`,
      email: "", phone: `081399${String(latest.current.length + index + 1).padStart(6, "0")}`,
      photo: "", pt: undefined, visits: [], activities: [], followUps: [],
    }));
    replace([...latest.current, ...added]);
  }

  return <Context.Provider value={{ today, members, plan, update, setPlan, fillLimit, reset: () => {
    replace(seedMembers(day()));
    setPlan("Free");
  } }}>{children}</Context.Provider>;
}

export function useMemberDemo() {
  const state = useContext(Context);
  if (!state) throw new Error("MemberDemoProvider is required");
  return state;
}
