"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";

export function RevenueChart({ data }: { data: { date: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="#e3e5e0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e3e5e0" }} />
        <Bar dataKey="revenue" fill="#145c43" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart({ data }: { data: { date: string; members: number; checkins: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="#e3e5e0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#8b9098" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e3e5e0" }} />
        <Line type="monotone" dataKey="members" stroke="#145c43" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="checkins" stroke="#2b5da8" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
