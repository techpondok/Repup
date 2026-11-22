"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Card, SectionLabel } from "@/components/ui/layout-bits";
import { formatCurrency } from "@/lib/format";
import type { Attendance, Payroll, Status } from "@/lib/demo/payroll";

export const money = (amount: number) => formatCurrency(amount, "IDR");

export function PayrollBadge({ status }: { status: Status }) {
  return <Badge tone={status === "Paid" ? "success" : status === "Pending Approval" ? "warning" : status === "Cancelled" ? "danger" : "neutral"}>{status}</Badge>;
}

export function AttendanceReview({ rows }: { rows: Attendance[] }) {
  const count = (status: Attendance["status"]) => rows.filter(row => row.status === status).length;
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {Object.entries({ "Working days": rows.length, Present: count("Present") + count("Late") + count("Overtime"), Absent: count("Absent"),
        Late: count("Late"), Leave: count("Leave"), "Overtime hours": rows.reduce((total, row) => total + row.overtime, 0) }).map(([label, amount]) => <Card key={label} className="p-3"><p className="text-xs text-ink-muted">{label}</p><strong>{amount}</strong></Card>)}
    </div>
    <details><summary className="cursor-pointer py-2 text-sm font-medium">Attendance details</summary>
      <DataTable className="w-full text-sm"><thead><tr>{["Date", "Check-in", "Check-out", "Status"].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.date} className="border-t border-line"><td className="p-2">{row.date}</td><td className="p-2">{row.in || "—"}</td><td className="p-2">{row.out || "—"}</td><td className="p-2">{row.status}</td></tr>)}</tbody>
      </DataTable>
    </details>
  </div>;
}

export function Earnings({ row }: { row: Payroll }) {
  return <div className="space-y-2">
    <Amount label="Basic salary" value={row.basic} />
    {row.allowances.map((item, index) => <Amount key={index} label={item.type + (item.reason ? " · " + item.reason : "")} value={item.amount} />)}
    <Amount label="Overtime" value={row.overtime} />
    <Amount label={row.sessions.length + " completed PT sessions · " + row.commissionRecipientRule} value={row.sessionPay} />
    <Amount label={"PT sales commission · eligible sales " + money(row.sales)} value={row.salesPay} />
    {!!row.sessions.length && <details className="text-sm"><summary className="cursor-pointer">Completed session sources</summary><ul className="mt-2 space-y-1">{row.sessions.map(session => <li key={session.id}>{session.date} · {session.id}</li>)}</ul></details>}
  </div>;
}

export function Deductions({ row }: { row: Payroll }) {
  return row.deductions.length ? <div className="space-y-2">{row.deductions.map((item, index) => <Amount key={index} label={item.type + " · " + item.reason} value={item.amount} />)}</div> : <p className="text-sm text-ink-muted">No deductions for this period.</p>;
}

function Amount({ label, value }: { label: string; value: number }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span>{label}</span><span className="num shrink-0 font-medium">{money(value)}</span></div>;
}

export function Totals({ row }: { row: Payroll }) {
  return <div className="space-y-2 border-t border-line pt-3"><Amount label="Gross salary" value={row.gross} /><Amount label="Total deductions" value={row.deduction} /><Amount label="Net salary" value={row.net} />
    {row.net < 0 && <p role="alert" className="text-sm text-danger">{row.adjustmentOf ? "This adjustment records a recovery." : "Deductions exceed gross pay. Review this payroll before saving."}</p>}
  </div>;
}

export function PayrollDetail({ row, gym, payslip, children }: { row: Payroll; gym: string; payslip: boolean; children?: React.ReactNode }) {
  return <div className="space-y-4">
    <div className="space-y-4" id="payroll-print">
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>{payslip && <p className="mb-2 font-semibold text-primary">RepUp Gym · {gym}</p>}<h3 className="font-semibold">{row.employee.name}</h3><p className="text-sm">{row.employee.code} · {row.employee.position} · {row.employee.employment.replaceAll("_", " ")}</p></div>
          <PayrollBadge status={row.status} />
        </div>
        <p className="text-sm">Period {row.period} · Cut-off {row.cutOff} · Payment {row.payment}</p>
        <p className="text-xs text-ink-muted">{row.salary.schedule} pay schedule{payslip && (" · Payslip " + row.id + " · " + row.note)}</p>
        {row.reviewNote && <p className="text-sm">Review note · {row.reviewNote}</p>}
      </Card>
      <Card className="space-y-4 p-5"><SectionLabel>Earnings</SectionLabel><Earnings row={row} /><SectionLabel>Deductions</SectionLabel><Deductions row={row} /><Totals row={row} /></Card>
    </div>
    {payslip ? <>
      <style media="print">{`body * { visibility: hidden; } #payroll-print, #payroll-print * { visibility: visible; } #payroll-print { position: fixed; inset: 0; color: #111; background: white; } dialog:has(#payroll-print) { position: static; overflow: visible; } dialog::backdrop { background: transparent; }`}</style>
      <Button onClick={() => window.print()}>Print / Save as PDF</Button>
    </> : <><AttendanceReview rows={row.attendance} />{children}</>}
  </div>;
}
