"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { TrainerDrawer } from "@/components/trainers/trainer-drawer";
import { useTrainerDemo } from "@/components/trainers/trainer-demo-provider";
import { useStaffDemo } from "@/components/staff/demo-provider";
import { useBranchDemo } from "@/components/branches/demo-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/layout-bits";
import { attendanceFor, calculatePayroll, defaultSettings, demoPeriod, initialSalaries, payrollEmployees, statuses, transitionPayroll, type Employee, type Payroll, type Salary, type Status } from "@/lib/demo/payroll";
import { money, PayrollBadge, PayrollDetail } from "./detail";
import { Choices, Field, SalaryForm, SettingsForm } from "./forms";
import { RunPayroll, type Branch } from "./wizard";

const overview = "/dashboard/payroll";
const ownEmployee: Record<string, string> = {
  TRAINER: "demo-trainer-2", RECEPTIONIST: "demo-payroll-receptionist", CASHIER: "demo-payroll-cashier", STAFF: "demo-payroll-staff",
};
const pageSize = 8;

function usePayrollState(branches: Branch[], employees: Employee[]) {
  const [salaries, setSalaries] = useState(() => initialSalaries(employees.filter(employee => /^demo-trainer-[123]$|^demo-payroll-/.test(employee.id))));
  const [settings, setSettings] = useState(defaultSettings);
  const [rows, setRows] = useState<Payroll[]>(() => salaries.filter(salary => ["demo-trainer-1", "demo-trainer-2", "demo-payroll-receptionist"].includes(salary.employeeId)).map(salary => {
    const employee = employees.find(item => item.id === salary.employeeId)!;
    return calculatePayroll(employee, salary, demoPeriod, defaultSettings, attendanceFor(employee, demoPeriod, defaultSettings), 0, "Paid");
  }));
  const [period, setPeriod] = useState(demoPeriod);
  const [branch, setBranch] = useState("");
  return { salaries, setSalaries, settings, setSettings, rows, setRows, period, setPeriod, branch, setBranch, branches, employees };
}

const Context = createContext<(ReturnType<typeof usePayrollState> & { role: string; gym: string }) | null>(null);

export function PayrollProvider({ role, gym, branches, children }: { role: string; gym: string; branches: Branch[]; children: ReactNode }) {
  const { details } = useTrainerDemo();
  const { staff } = useStaffDemo();
  const scope = useBranchDemo();
  const employees = payrollEmployees(details, staff);
  const state = usePayrollState(scope?.active ?? branches, employees);
  return <Context.Provider value={{ ...state, role, gym }}>{children}</Context.Provider>;
}

const nextActions: { from: Status; to: Status; label: string }[] = [
  { from: "Draft", to: "Pending Approval", label: "Submit for Approval" },
  { from: "Draft", to: "Cancelled", label: "Cancel Draft" },
  { from: "Pending Approval", to: "Approved", label: "Approve" },
  { from: "Pending Approval", to: "Draft", label: "Reject / Return to Draft" },
  { from: "Approved", to: "Paid", label: "Mark as Paid" },
];

function exportCsv(rows: Payroll[]) {
  const cell = (value: string | number) => {
    const text = String(value);
    return '"' + (/^[=+@\-]/.test(text) && typeof value === "string" ? "'" + text : text).replaceAll('"', '""') + '"';
  };
  const data = [["Period", "Employee", "Employee ID", "Branch", "Gross", "Deductions", "Net", "Status"],
    ...rows.map(row => [row.period, row.employee.name, row.employee.code, row.employee.branch, row.gross, row.deduction, row.net, row.status])];
  const url = URL.createObjectURL(new Blob(["\uFEFF" + data.map(line => line.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "repup-payroll.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PayrollWorkspace({ view }: { view: "overview" | "history" | "settings" }) {
  const state = useContext(Context)!;
  const branchScope = useBranchDemo();
  const { role, gym, employees, branches, rows, setRows, salaries, setSalaries, settings, setSettings, period, setPeriod, branch, setBranch } = state;
  const owner = role === "OWNER";
  const prepare = owner || role === "ADMIN";
  const own = ownEmployee[role];
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [historyPeriod, setHistoryPeriod] = useState("");
  const [expandedPeriod, setExpandedPeriod] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [sort, setSort] = useState("Employee");
  const [page, setPage] = useState(0);
  const [panel, setPanel] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [salaryId, setSalaryId] = useState(employees[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ to: Status; label: string } | null>(null);
  const [review, setReview] = useState("");

  const accessible = (prepare ? rows : rows.filter(row => row.employee.id === own && row.status === "Paid"))
    .filter(row => !branchScope || (branchScope.scope ? row.employee.branch === branchScope.scope.id : branchScope.allowed.some(item => item.id === row.employee.branch)));
  const scopedEmployees = (prepare ? employees : employees.filter(employee => employee.id === own))
    .filter(employee => !branchScope || branchScope.scopedIds.includes(employee.branch));
  const scoped = accessible.filter(row => (!branch || row.employee.branch === branch) && (!period || row.period === period));
  const filterRows = (items: Payroll[]) => items.filter(row => (!status || row.status === status)
    && (!employeeId || row.employee.id === employeeId)
    && (row.employee.name + " " + row.employee.code).toLowerCase().includes(query.trim().toLowerCase()));
  const overviewRows = filterRows(scoped).sort((left, right) => sort === "Net salary" ? right.net - left.net : sort === "Status" ? left.status.localeCompare(right.status) : left.employee.name.localeCompare(right.employee.name));
  const historyRows = filterRows(accessible.filter(row => (!branch || row.employee.branch === branch) && (!historyPeriod || row.period === historyPeriod)));
  const periods = [...new Set(historyRows.map(row => row.period))].sort().reverse();
  const current = accessible.find(row => row.id === selectedId);
  const currentSalary = salaries.filter(salary => salary.employeeId === salaryId).sort((left, right) => right.effective.localeCompare(left.effective))[0];
  const salaryEmployee = employees.find(employee => employee.id === salaryId);
  const summary = scoped.filter(row => row.status !== "Cancelled");
  const total = (items: Payroll[], key: "gross" | "deduction" | "net") => items.reduce((sum, row) => sum + row[key], 0);
  const notify = (text: string) => { setError(""); setMessage(text); };
  const open = (next: string, row?: Payroll) => { setError(""); setMessage(""); setConfirm(null); setReview(""); setSelectedId(row?.id ?? ""); setPanel(next); };
  const close = () => { setError(""); setPanel(""); setConfirm(null); setReview(""); };
  const goToFirst = (change: (value: string) => void, value: string) => { change(value); setPage(0); };

  function savePayroll(previews: Payroll[], next: Status, selectedPeriod: string, selectedBranch: string) {
    if (!prepare || previews.some(row => rows.some(existing => existing.id === row.id))) {
      setError("This employee already has payroll for the selected period."); return;
    }
    setRows(previous => [...previous, ...previews.filter(row => !previous.some(existing => existing.id === row.id)).map(row => ({ ...row, status: next }))]);
    setPeriod(selectedPeriod); setBranch(selectedBranch); setPage(0); setStatus(""); setQuery(""); setEmployeeId(""); close();
    notify(next === "Draft" ? "Payroll drafts saved." : "Payroll submitted for approval.");
  }

  function saveSalary(value: Salary) {
    if (!owner || value.deductions.some(item => !item.reason.trim())) { setError("Enter a reason for every deduction."); return; }
    setSalaries(previous => [...previous.filter(item => item.employeeId !== value.employeeId || item.effective !== value.effective), value]);
    close(); notify("Salary configuration saved.");
  }

  function editDraft(value: Salary) {
    if (!prepare || current?.status !== "Draft" || value.deductions.some(item => !item.reason.trim())) { setError("Enter a reason for every deduction."); return; }
    const updated = calculatePayroll({ ...current.employee, sessions: current.sessions }, value, current.period, current.settings, current.attendance, current.sales);
    if (updated.net < 0) { setError("Deductions exceed gross pay. Review the draft."); return; }
    setRows(previous => previous.map(row => row.id === updated.id && row.status === "Draft" ? updated : row));
    setPanel("details"); notify("Draft changes saved.");
  }

  function changeStatus() {
    if (!current || !confirm || !transitionPayroll(current.status, confirm.to, role)) return;
    if (confirm.to === "Approved" && current.settings.approval === "Owner approval with review note" && !review.trim()) return;
    const next = confirm.to;
    setRows(previous => previous.map(row => row.id === current.id && transitionPayroll(row.status, next, role)
      ? { ...row, status: next, reviewNote: review.trim() || row.reviewNote } : row));
    setConfirm(null); setReview(""); notify(next === "Paid" ? "Recorded as paid in the simulation." : "Payroll status updated.");
  }

  if (!prepare && !own) return <><PageHeader title="Payroll Management" /><EmptyState title="Payroll access unavailable" description="Your demo role has no linked payroll employee." /></>;
  if (view === "settings" && !owner) return <><PageHeader title="Payroll Settings" /><EmptyState title="Owner access required" action={<LinkButton href={overview}>Back to payroll</LinkButton>} /></>;

  const employeeCount = (items: Payroll[]) => new Set(items.map(row => row.employee.id)).size;
  const renderRows = (items: Payroll[]) => <DataTable className="w-full min-w-[900px] text-sm">
    <thead><tr className="border-b border-line text-left text-xs text-ink-faint">{["Employee", "Position", "Basic Salary", "Allowance & Bonus", "Deduction", "Net Salary", "Payment Status", "Action"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
    <tbody>{items.map(row => <tr key={row.id} className="border-b border-line last:border-0">
      <td className="p-3"><div className="flex items-center gap-2"><span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary-tint text-xs text-primary">
        {row.employee.photo ? <span aria-hidden="true" className="size-full bg-cover bg-center" style={{ backgroundImage: `url("${row.employee.photo}")` }} /> : row.employee.name.split(" ").slice(0, 2).map(part => part[0]).join("")}</span>
        <div><p className="font-medium">{row.employee.name}</p><p className="text-xs text-ink-muted">{row.employee.code}{row.adjustmentOf && " · Adjustment"}</p></div></div></td>
      <td className="p-3">{row.employee.position}</td><td className="p-3">{money(row.basic)}</td><td className="p-3">{money(row.allowance)}</td>
      <td className="p-3">{money(row.deduction)}</td><td className="p-3 font-medium">{money(row.net)}</td><td className="p-3"><PayrollBadge status={row.status} /></td>
      <td className="p-3"><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => open("details", row)}>View Details</Button><Button size="sm" variant="ghost" onClick={() => open("payslip", row)}>View Payslip</Button></div></td>
    </tr>)}</tbody>
  </DataTable>;

  return <div className="space-y-5">
    <PageHeader title={view === "overview" ? "Payroll Management" : view === "history" ? "Payroll History" : "Payroll Settings"}
      description={view === "overview" ? "Manage employee salaries, commissions, and monthly payroll." : undefined}
      actions={<>
        {view !== "overview" && <LinkButton href={overview} variant="secondary">Payroll Overview</LinkButton>}
        {view === "overview" && prepare && <Button onClick={() => open("wizard")}>Run Payroll</Button>}
        {view !== "history" && <LinkButton href={overview + "/history"} variant="secondary">View Payroll History</LinkButton>}
        {view !== "settings" && owner && <LinkButton href={overview + "/settings"} variant="secondary">Payroll Settings</LinkButton>}
        {view === "overview" && owner && employees.length > 0 && <Button variant="secondary" onClick={() => open("salary")}>Salary Configuration</Button>}
        {view === "history" && <Button disabled={!historyRows.length} onClick={() => exportCsv(historyRows)}>Export CSV</Button>}
      </>} />
    <p className="text-sm text-ink-muted">Fictional data · Frontend simulation</p>
    {message && <p role="status" className="rounded-md bg-primary-tint p-3 text-sm text-primary">{message}</p>}
    {view === "settings" ? <SettingsForm initial={settings} save={value => { setSettings(value); notify("Payroll settings saved."); }} /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Month and year"><Input type="month" required={view === "overview"} value={view === "history" ? historyPeriod : period} onChange={event => goToFirst(view === "history" ? setHistoryPeriod : setPeriod, event.target.value)} /></Field>
        <Field label="Branch"><Select value={branch} onChange={event => goToFirst(setBranch, event.target.value)}><option value="">All branches</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        <Field label="Status"><Select value={status} onChange={event => goToFirst(setStatus, event.target.value)}><option value="">All statuses</option><Choices values={prepare ? statuses : ["Paid"]} /></Select></Field>
        {view === "overview" ? <>
          <Field label="Search employee"><Input type="search" value={query} onChange={event => goToFirst(setQuery, event.target.value)} placeholder="Name or employee ID" /></Field>
          <Field label="Sort by"><Select value={sort} onChange={event => goToFirst(setSort, event.target.value)}><Choices values={["Employee", "Net salary", "Status"]} /></Select></Field>
        </> : <Field label="Employee"><Select value={employeeId} onChange={event => goToFirst(setEmployeeId, event.target.value)}><option value="">All employees</option>{scopedEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select></Field>}
      </div>
      {view === "overview" ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Payroll" value={money(total(summary, "net"))} />
          <StatCard label="Total Employees" value={String(employeeCount(summary))} />
          <StatCard label="Pending Payments" value={String(employeeCount(summary.filter(row => row.status !== "Paid")))} />
          <StatCard label="Paid Employees" value={String(employeeCount(summary.filter(row => row.status === "Paid")))} />
        </div>
        {overviewRows.length ? <Card>{renderRows(overviewRows.slice(page * pageSize, (page + 1) * pageSize))}
          <div className="flex items-center justify-between gap-2 p-3 text-sm"><Button variant="secondary" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1} of {Math.ceil(overviewRows.length / pageSize)}</span><Button variant="secondary" disabled={(page + 1) * pageSize >= overviewRows.length} onClick={() => setPage(page + 1)}>Next</Button></div>
        </Card> : <EmptyState title="No payroll matches" description="Change the filters or select another period." />}
      </> : periods.length ? <>
        <Card><DataTable className="w-full min-w-[780px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-ink-faint">{["Payroll Period", "Employees", "Total Gross Salary", "Total Deductions", "Total Net Salary", "Status", "Actions"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
          <tbody>{periods.map(key => {
            const items = historyRows.filter(row => row.period === key);
            return <tr key={key} className="border-b border-line last:border-0">
              <td className="p-3 font-medium">{key}</td><td className="p-3">{employeeCount(items)}</td>
              <td className="p-3">{money(total(items, "gross"))}</td><td className="p-3">{money(total(items, "deduction"))}</td>
              <td className="p-3">{money(total(items, "net"))}</td><td className="p-3">{[...new Set(items.map(row => row.status))].map(status => <PayrollBadge key={status} status={status} />)}</td>
              <td className="p-3"><Button size="sm" variant="secondary" aria-expanded={expandedPeriod === key} onClick={() => setExpandedPeriod(expandedPeriod === key ? "" : key)}>View Period {key}</Button></td>
            </tr>;
          })}</tbody>
        </DataTable></Card>
        {periods.includes(expandedPeriod) && <Card><h2 className="border-b border-line p-4 font-medium">Employee payroll · {expandedPeriod}</h2>{renderRows(historyRows.filter(row => row.period === expandedPeriod))}</Card>}
      </> : <EmptyState title="No payroll history matches" />}
    </>}

    {panel && <TrainerDrawer title={panel === "wizard" ? "Run Payroll" : panel === "salary" ? "Salary Configuration" : panel === "payslip" ? "Payslip Preview" : panel === "edit" ? "Edit Draft" : panel === "adjust" ? "Payroll Adjustment" : "Payroll Details"} onClose={close}>
      {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
      {panel === "wizard" && prepare && <RunPayroll initialPeriod={period} initialBranch={branchScope?.scope?.id ?? branch} employees={scopedEmployees} branches={branches.filter(item => !branchScope || branchScope.scopedIds.includes(item.id))} salaries={salaries} settings={settings} existing={rows} save={savePayroll} />}
      {panel === "salary" && owner && salaryEmployee && <SalaryForm key={salaryId} employees={employees} initial={currentSalary ?? initialSalaries([salaryEmployee])[0]} onEmployee={setSalaryId} onSave={saveSalary} />}
      {panel === "edit" && current?.status === "Draft" && prepare && <SalaryForm employees={[current.employee]} initial={current.salary} onEmployee={() => {}} onSave={editDraft} draft />}
      {panel === "adjust" && current?.status === "Paid" && owner && <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const amount = Number(data.get("amount"));
        const reason = String(data.get("reason") ?? "").trim();
        if (!reason || !Number.isSafeInteger(amount) || !amount) { setError("Enter a non-zero amount and a reason."); return; }
        const salary: Salary = { ...current.salary, base: 0, type: "Monthly Salary", sessionRate: 0, salesRate: 0,
          allowances: amount > 0 ? [{ type: "Custom Allowance", amount, reason, period: current.period, calculation: "Fixed" }] : [],
          deductions: amount < 0 ? [{ type: "Other Deduction", amount: -amount, reason, period: current.period, calculation: "Fixed" }] : [],
        };
        const adjustment = calculatePayroll(current.employee, salary, current.period, current.settings, []);
        const id = current.id + "-adjustment-" + crypto.randomUUID();
        setRows(previous => [...previous, { ...adjustment, id, adjustmentOf: current.id }]);
        close(); notify("Adjustment saved as a separate draft.");
      }}><Field label="Adjustment amount (Rp)"><Input name="amount" type="number" min={-1000000000} max={1000000000} required /></Field>
        <Field label="Reason"><Input name="reason" required /></Field>
        <p className="text-sm text-ink-muted">Use a negative amount for a recovery. The original paid payroll remains a separate record.</p>
        <Button type="submit">Save adjustment draft</Button>
      </form>}
      {current && (panel === "details" || panel === "payslip") && <PayrollDetail row={current} gym={gym} payslip={panel === "payslip"}>
        <div className="flex flex-wrap gap-2">
          {prepare && current.status === "Draft" && !current.adjustmentOf && <Button variant="secondary" onClick={() => setPanel("edit")}>Edit Draft</Button>}
          {owner && current.status === "Paid" && !current.adjustmentOf && <Button variant="secondary" onClick={() => setPanel("adjust")}>Create Adjustment</Button>}
          {nextActions.filter(action => action.from === current.status && transitionPayroll(current.status, action.to, role)).map(action =>
            <Button key={action.to} variant="secondary" onClick={() => setConfirm(action)}>{action.label}</Button>)}
          <Button variant="secondary" onClick={() => setPanel("payslip")}>Preview Payslip</Button>
        </div>
        {confirm?.to === "Approved" && current.settings.approval === "Owner approval with review note" &&
          <form className="space-y-2" onSubmit={event => { event.preventDefault(); changeStatus(); }}><Field label="Approval review note"><Input required value={review} onChange={event => setReview(event.target.value)} /></Field><div className="flex flex-wrap gap-2"><Button type="submit">Confirm Approval</Button><Button type="button" variant="secondary" onClick={() => { setConfirm(null); setReview(""); }}>Cancel</Button></div></form>}
        <ConfirmDialog open={!!confirm && !(confirm.to === "Approved" && current.settings.approval === "Owner approval with review note")} title={confirm?.label ?? ""} description={confirm?.to === "Paid" ? "Confirm that the manual payment has been recorded for this simulation." : "Confirm this payroll status change."} confirmLabel={confirm?.label} onClose={() => { setConfirm(null); setReview(""); }} onConfirm={changeStatus} />
      </PayrollDetail>}
    </TrainerDrawer>}
  </div>;
}
