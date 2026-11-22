"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip cursor={{ fill: "var(--elevated)" }} contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
        <Bar name="Pendapatan" dataKey="revenue" fill="var(--primary)" maxBarSize={32} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart({ data }: { data: { date: string; members: number; checkins: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
        <Line name="Member" type="monotone" dataKey="members" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
        <Line name="Check-in" type="monotone" dataKey="checkins" stroke="var(--info)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
