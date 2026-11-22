"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";
import { Card, SectionLabel } from "@/components/ui/layout-bits";
import { allowanceTypes, deductionTypes, salaryTypes, type Component, type Employee, type Salary, type Settings } from "@/lib/demo/payroll";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <Label>{label}<span className="mt-1 block">{children}</span></Label>;
}

export function Choices({ values }: { values: readonly string[] }) {
  return <>{values.map(value => <option key={value}>{value}</option>)}</>;
}

export function ComponentsEditor({ kind, items, onChange }: { kind: "allowance" | "deduction"; items: Component[]; onChange: (items: Component[]) => void }) {
  const types = kind === "allowance" ? allowanceTypes : deductionTypes;
  function update(index: number, patch: Partial<Component>) {
    onChange(items.map((item, position) => position === index ? { ...item, ...patch } : item));
  }
  return <Card className="space-y-3 p-4">
    <SectionLabel>{kind === "allowance" ? "Allowances & bonuses" : "Deductions"}</SectionLabel>
    {items.map((item, index) => <div key={index} className="grid gap-2 border-b border-line pb-3 sm:grid-cols-2">
      <Field label="Type"><Select value={item.type} onChange={event => update(index, { type: event.target.value })}><Choices values={types} /></Select></Field>
      <Field label="Amount (Rp)"><Input type="number" min={0} max={1000000000} required value={item.amount} onChange={event => update(index, { amount: Number(event.target.value) })} /></Field>
      <Field label={kind === "allowance" ? "Description" : "Reason"}><Input required={kind === "deduction"} value={item.reason} onChange={event => update(index, { reason: event.target.value })} /></Field>
      <Field label="Effective period (optional)"><Input type="month" value={item.period} onChange={event => update(index, { period: event.target.value })} /></Field>
      {kind === "allowance" && <Field label="Calculation"><Select value={item.calculation} onChange={event => update(index, { calculation: event.target.value as Component["calculation"] })}><Choices values={["Fixed", "Variable"]} /></Select></Field>}
      <div><Button type="button" variant="ghost" onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove component</Button></div>
    </div>)}
    <Button type="button" variant="secondary" onClick={() => onChange([...items, { type: types[0], amount: 0, reason: "", period: "", calculation: "Fixed" }])}>Add {kind}</Button>
  </Card>;
}

export function SalaryForm({ employees, initial, onEmployee, onSave, draft = false }: { employees: Employee[]; initial: Salary; onEmployee: (id: string) => void; onSave: (salary: Salary) => void; draft?: boolean }) {
  const [value, setValue] = useState(initial);
  const employee = employees.find(item => item.id === value.employeeId)!;
  const update = (patch: Partial<Salary>) => setValue(current => ({ ...current, ...patch }));
  const trainer = employee.position === "Personal Trainer";
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); onSave(value); }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Employee"><Select disabled={draft} value={employee.id} onChange={event => onEmployee(event.target.value)}>{employees.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      <Field label="Position"><Input readOnly value={employee.position} /></Field>
      <Field label="Employment type"><Input readOnly value={employee.employment.replaceAll("_", " ")} /></Field>
      <Field label="Salary type"><Select value={value.type} onChange={event => update({ type: event.target.value as Salary["type"] })}><Choices values={salaryTypes.filter(type => trainer || type !== "Per Session")} /></Select></Field>
      <Field label="Base salary / unit rate (Rp)"><Input required type="number" min={0} max={1000000000} value={value.base} onChange={event => update({ base: Number(event.target.value) })} /></Field>
      <Field label="Payment schedule"><Select value={value.schedule} onChange={event => update({ schedule: event.target.value })}><Choices values={["Monthly", "Biweekly", "Weekly"]} /></Select></Field>
      <Field label="Effective date"><Input required type="date" disabled={draft} value={value.effective} onChange={event => update({ effective: event.target.value })} /></Field>
      {!draft && <Field label="Fictional bank reference (optional)"><Input placeholder="Demo reference only" value={value.bank} onChange={event => update({ bank: event.target.value })} /></Field>}
      {trainer && <><Field label="Commission per completed PT session (Rp)"><Input type="number" min={0} max={1000000000} value={value.sessionRate} onChange={event => update({ sessionRate: Number(event.target.value) })} /></Field>
        <Field label="PT sales commission (%)"><Input type="number" min={0} max={100} step="0.01" value={value.salesRate} onChange={event => update({ salesRate: Number(event.target.value) })} /></Field></>}
    </div>
    <ComponentsEditor kind="allowance" items={value.allowances} onChange={allowances => update({ allowances })} />
    <ComponentsEditor kind="deduction" items={value.deductions} onChange={deductions => update({ deductions })} />
    <Button type="submit">{draft ? "Save draft changes" : "Save salary configuration"}</Button>
  </form>;
}

export function SettingsForm({ initial, save }: { initial: Settings; save: (settings: Settings) => void }) {
  const [value, setValue] = useState(initial);
  const numberField = (key: keyof Settings, label: string, min: number, max: number) => <Field label={label}><Input required type="number" min={min} max={max} value={value[key]} onChange={event => setValue({ ...value, [key]: Number(event.target.value) })} /></Field>;
  const selectField = (key: keyof Settings, label: string, options: string[]) => <Field label={label}><Select value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })}><Choices values={options} /></Select></Field>;
  return <form className="max-w-3xl space-y-5" onSubmit={event => { event.preventDefault(); save(value); }}>
    <Card className="grid gap-3 p-5 sm:grid-cols-2">
      {selectField("period", "Payroll period preference", ["Monthly", "Biweekly", "Weekly"])}
      {numberField("cutoff", "Cut-off day", 1, 31)}
      {numberField("payment", "Payment day", 1, 31)}
      {numberField("workdays", "Default working days per week", 1, 7)}
      {numberField("hours", "Default working hours per day", 1, 24)}
      {numberField("overtimeRate", "Overtime rate (Rp per hour)", 0, 1000000000)}
      {numberField("lateRate", "Late deduction (Rp per arrival)", 0, 1000000000)}
      {selectField("commissionMode", "Commission rule", ["Sessions", "Sales", "Sessions + Sales"])}
      {selectField("substitute", "Substitute commission recipient", ["Session trainer", "Assigned trainer"])}
      {selectField("approval", "Approval workflow", ["Owner approval", "Owner approval with review note"])}
      {(["thr", "bpjs", "tax"] as const).map(key => <Field key={key} label={key.toUpperCase() + " policy"}><Input value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} /></Field>)}
      <Field label="Payslip note"><Input value={value.payslipNote} onChange={event => setValue({ ...value, payslipNote: event.target.value })} /></Field>
    </Card>
    <p className="text-sm text-ink-muted">Demo payroll runs are monthly. Weekly and biweekly preferences are saved for reference. Enter tax, BPJS and THR amounts manually.</p>
    <Button type="submit">Save payroll settings</Button>
  </form>;
}
