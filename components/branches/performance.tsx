"use client";

import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/layout-bits";
import { DataTable } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/button";
import { rupiah } from "./billing";
import { useBranchMetrics } from "./metrics";
import { useBranchDemo } from "./demo-provider";

export function BranchPerformance({ report = false }: { report?: boolean }) {
  const demo = useBranchDemo();
  const { rows } = useBranchMetrics();
  const sum = (key: "activeMembers" | "revenue" | "checkins") => rows.reduce((total, row) => total + row[key], 0);
  return <div className="space-y-5">
    <PageHeader title={report ? "Branch Reports" : "Dashboard"} description={(demo?.scope?.name ?? "All Branches") + " · Demo"} actions={<LinkButton href="/branches" variant="secondary">Branch Management</LinkButton>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total Active Members", sum("activeMembers")], ["Monthly Revenue", rupiah(sum("revenue"))], ["Monthly Check-ins", sum("checkins")], ["Active Branches", rows.length]].map(([label, value]) => <StatCard key={label} label={String(label)} value={String(value)} />)}</div>
    {rows.length ? <Card><h2 className="border-b border-line p-4 font-medium">Branch Performance</h2><DataTable className="w-full min-w-[520px] text-sm">
      <thead><tr className="border-b border-line text-left text-xs text-ink-faint">{["Branch", "Members", "Revenue", "Check-ins"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
      <tbody>{rows.map(({ branch, activeMembers, revenue, checkins }) => <tr key={branch.id} className="border-b border-line last:border-0"><td className="p-3 font-medium">{branch.name}</td><td className="p-3">{activeMembers}</td><td className="p-3">{rupiah(revenue)}</td><td className="p-3">{checkins}</td></tr>)}</tbody>
    </DataTable></Card> : <EmptyState title="No active branch data" />}
  </div>;
}
