"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Card, EmptyState, Stat } from "@/components/ui/layout-bits";

export const dateLabel = (value?: string) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "—";
export const timeLabel = (value?: string) => value ? new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) : "—";
export const dateTimeLabel = (value?: string) => value ? `${dateLabel(value)} · ${timeLabel(value)}` : "—";

export function Avatar({ name, photo, large }: { name: string; photo?: string; large?: boolean }) {
  const size = large ? 64 : 40;
  const [failedPhoto, setFailedPhoto] = useState("");
  return photo && failedPhoto !== photo ? <Image src={photo} alt="" width={size} height={size} unoptimized onError={() => setFailedPhoto(photo)} className="aspect-square shrink-0 rounded-full object-cover" /> :
    <span aria-hidden="true" style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-primary-tint font-semibold text-primary">{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>;
}

export function Status({ value }: { value: string }) {
  return <Badge tone={value === "Active" || value === "Renewed" ? "success" : value === "Expiring Soon" || value === "Frozen" ? "warning" : value === "Expired" ? "danger" : "neutral"}>{value}</Badge>;
}

export function Facts({ values }: { values: [string, ReactNode][] }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3">
    {values.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}
  </dl>;
}

export function Stats({ values }: { values: [string, string | number][] }) {
  return <Card className="grid grid-cols-3 overflow-hidden" statGroup>{values.map(([label, value]) => <Stat key={label} label={label} value={String(value)} />)}</Card>;
}

export type Row = { id: string; cells: ReactNode[] };
export function MemberTable({ headers, rows, empty, mobile = false }: { headers: string[]; rows: Row[]; empty: string; mobile?: boolean }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <>
    <div className={mobile ? "hidden lg:block" : undefined}>
      <DataTable className="min-w-[650px]">
        <thead><tr className="border-b border-line text-left text-xs text-ink-muted">
          {headers.map(label => <th scope="col" key={label} className="px-4 py-3 font-medium">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className="border-b border-line last:border-0">
          {row.cells.map((cell, index) => <td key={headers[index]} className="px-4 py-3 align-middle">{cell}</td>)}
        </tr>)}</tbody>
      </DataTable>
    </div>
    {mobile && <ul className="divide-y divide-line lg:hidden">{rows.map(row => <li className="p-4" key={row.id}>
      {row.cells[0]}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{row.cells.slice(1, -1).map((cell, index) => <div key={headers[index + 1]} className="min-w-0">
        <dt className="text-xs text-ink-muted">{headers[index + 1]}</dt><dd className="mt-1 break-words">{cell}</dd>
      </div>)}</dl>
      <div className="mt-3 border-t border-line pt-2">{row.cells.at(-1)}</div>
    </li>)}</ul>}
  </>;
}
