"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createTrainerDemo } from "@/lib/trainer-management-demo";

type Details = ReturnType<typeof createTrainerDemo>;
const Context = createContext<{ details: Details; setDetails: (details: Details) => void } | null>(null);
export function TrainerDemoProvider({ children }: { children: ReactNode }) {
  const [details, setDetails] = useState(createTrainerDemo);
  return <Context.Provider value={{ details, setDetails }}>{children}</Context.Provider>;
}

export function useTrainerDemo() {
  const context = useContext(Context);
  if (!context) throw new Error("TrainerDemoProvider is required.");
  return context;
}
