"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/layout-bits";
import { attendanceFor, calculatePayroll, periodDate, type Employee, type Payroll, type Salary, type Settings, type Status } from "@/lib/demo/payroll";
import { AttendanceReview, Deductions, Earnings, Totals } from "./detail";
import { Field } from "./forms";

const steps = ["Select period", "Review attendance", "Review earnings", "Review deductions", "Payroll preview", "Confirm payroll"];

export type Branch = { id: string; name: string };

export function RunPayroll({ initialPeriod, initialBranch, employees, salaries, settings, branches, existing, save }: {
  initialPeriod: string; initialBranch: string; employees: Employee[]; salaries: Salary[]; settings: Settings; branches: Branch[];
  existing: Payroll[]; save: (rows: Payroll[], status: Status, period: string, branch: string) => void;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [branch, setBranch] = useState(initialBranch);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [sales, setSales] = useState<Record<string, number>>({});
  const [absences, setAbsences] = useState<Record<string, string[]>>({});
  const eligible = employees.filter(employee => !branch || employee.branch === branch);
  const chosen = eligible.filter(employee => selected.includes(employee.id));
  const blocked = (employee: Employee) => existing.some(row => row.employee.id === employee.id && row.period === period);
  const previews = chosen.map(employee => {
    const salary = salaries.filter(config => config.employeeId === employee.id && config.effective <= periodDate(period, settings.cutoff))
      .sort((left, right) => right.effective.localeCompare(left.effective))[0];
    const attendance = attendanceFor(employee, period, settings).map(row => absences[employee.id]?.includes(row.date)
      ? { ...row, status: "Absent" as const, in: "", out: "", overtime: 0 } : row);
    return { employee, row: salary ? calculatePayroll(employee, salary, period, settings, attendance, sales[employee.id] ?? 0) : null };
  });
  const invalid = previews.some(item => !item.row || item.row.net < 0 || item.row.deductions.some(deduction => !deduction.reason.trim()));
  const rows = previews.flatMap(item => item.row ? [item.row] : []);
  const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(period);

  return <div className="space-y-4">
    <p className="text-sm font-medium text-primary">Step {step + 1} / {steps.length} · {steps[step]}</p>
    {step === 0 ? <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Month and year"><Input type="month" value={period} onChange={event => { setPeriod(event.target.value); setSelected([]); setAbsences({}); setSales({}); }} /></Field>
        <Field label="Gym branch"><Select value={branch} onChange={event => { setBranch(event.target.value); setSelected([]); }}><option value="">All branches</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Employees</legend>
        {eligible.map(employee => <label key={employee.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={blocked(employee)} checked={selected.includes(employee.id)} onChange={event => {
          setSelected(current => event.target.checked ? [...current, employee.id] : current.filter(id => id !== employee.id));
        }} />{employee.name}{blocked(employee) && " · Payroll already exists"}</label>)}
        {!eligible.length && <p className="text-sm text-ink-muted">No employees at this branch.</p>}
      </fieldset>
    </> : previews.map(({ employee, row }) => <Card key={employee.id} className="space-y-4 p-4">
      <h3 className="font-semibold">{employee.name}</h3>
      {!row ? <p role="alert" className="text-sm text-danger">No salary configuration is effective by the cut-off date.</p> : <>
        {step === 1 && <>
          <AttendanceReview rows={row.attendance} />
          <Field label="Mark a scheduled workday absent (simulation)"><Select value="" onChange={event => {
            const date = event.target.value;
            if (date) setAbsences(current => ({ ...current, [employee.id]: [...(current[employee.id] ?? []), date] }));
          }}><option value="">Select date</option>{row.attendance.filter(day => day.status !== "Absent" && day.status !== "Leave").map(day => <option key={day.date}>{day.date}</option>)}</Select></Field>
          {!!absences[employee.id]?.length && <Button variant="ghost" onClick={() => setAbsences(current => ({ ...current, [employee.id]: [] }))}>Reset attendance edits</Button>}
        </>}
        {step === 2 && <>
          {employee.position === "Personal Trainer" && settings.commissionMode !== "Sessions" && <Field label="Eligible PT package sales (Rp, simulation)"><Input type="number" min={0} max={1000000000} value={sales[employee.id] ?? 0} onChange={event => setSales(current => ({ ...current, [employee.id]: Math.max(0, Math.min(1000000000, Number(event.target.value))) }))} /></Field>}
          <Earnings row={row} />
        </>}
        {step === 3 && <Deductions row={row} />}
        {step >= 4 && <Totals row={row} />}
      </>}
    </Card>)}
    {step === 4 && <p className="text-sm text-ink-muted">Gross includes base, allowances, bonuses, commissions and overtime. Net subtracts all deductions.</p>}
    {step === 5 && <p className="text-sm text-ink-muted">Save for editing or send to the owner for approval. Amounts are snapshots of these inputs.</p>}
    <div className="flex flex-wrap justify-end gap-2">
      {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
      {step < 5 ? <Button disabled={step === 0 && (!validPeriod || !chosen.length || chosen.some(blocked))} onClick={() => setStep(step + 1)}>Continue</Button> : <>
        <Button variant="secondary" disabled={invalid || !rows.length} onClick={() => save(rows, "Draft", period, branch)}>Save Draft</Button>
        <Button disabled={invalid || !rows.length} onClick={() => save(rows, "Pending Approval", period, branch)}>Submit for Approval</Button>
      </>}
    </div>
  </div>;
}
