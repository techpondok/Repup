import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("./payroll.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
const payroll = {};
runInNewContext(outputText, { exports: payroll, require: () => ({ trainerBranchIds: () => [] }) });
const employee = {
  id: "demo-trainer-2", name: "Sarah", code: "TRN-2", position: "Personal Trainer",
  employment: "full_time", weekdays: [1, 2, 3, 4, 5],
  sessions: [
    ...Array.from({ length: 20 }, (_, index) => ({ id: String(index), date: "2026-11-02", status: "completed" })),
    { id: "0", date: "2026-11-02", status: "completed" },
    { id: "cancelled", date: "2026-11-02", status: "cancelled" },
    { id: "pending", date: "2026-11-02", status: "pending" },
    { id: "after-cutoff", date: "2026-11-26", status: "completed" },
  ],
};
const period = "2026-11";
const settings = payroll.defaultSettings;

test("computes demo salary and ignores duplicate, pending, cancelled and post-cutoff sessions", () => {
  const [salary] = payroll.initialSalaries([employee]);
  const attendance = payroll.attendanceFor(employee, period, settings);
  const row = payroll.calculatePayroll(employee, salary, period, settings, attendance);
  assert.equal(row.sessions.length, 20);
  assert.equal(row.sessionPay, 1_000_000);
  assert.equal(row.gross, 3_300_000);
  assert.equal(row.net, 3_200_000);
});

test("supports separate and combined sales commissions with manual attendance rules", () => {
  const [configured] = payroll.initialSalaries([employee]);
  const salary = { ...configured, salesRate: 10 };
  const rules = { ...settings, commissionMode: "Sessions + Sales", lateRate: 10_000, overtimeRate: 20_000 };
  const attendance = payroll.attendanceFor(employee, period, rules);
  const combined = payroll.calculatePayroll(employee, salary, period, rules, attendance, 5_000_000);
  assert.equal(combined.salesPay, 500_000);
  assert.equal(combined.sessionPay, 1_000_000);
  assert.equal(combined.overtime, 40_000);
  assert.equal(combined.deduction, 110_000);
  assert.equal(combined.net, 3_730_000);
  assert.equal(payroll.calculatePayroll(employee, salary, period, { ...rules, commissionMode: "Sales" }, attendance, 5_000_000).sessionPay, 0);
});

test("daily pay uses worked days and a paid snapshot survives subsequent salary configuration", () => {
  const [configured] = payroll.initialSalaries([employee]);
  const salary = { ...configured, type: "Daily Wage", base: 150_000, sessionRate: 0 };
  const attendance = payroll.attendanceFor(employee, period, settings);
  const paid = payroll.calculatePayroll(employee, salary, period, settings, attendance, 0, "Paid");
  const worked = attendance.filter(row => ["Present", "Late", "Overtime"].includes(row.status)).length;
  const future = payroll.calculatePayroll(employee, { ...salary, base: 200_000 }, period, settings, attendance);
  assert.equal(paid.basic, worked * 150_000);
  assert.equal(future.basic, worked * 200_000);
  assert.equal(paid.status, "Paid");
});

test("approvals and manual payment respect role and legal state transitions", () => {
  const transition = payroll.transitionPayroll;
  assert.equal(transition("Draft", "Pending Approval", "ADMIN"), true);
  assert.equal(transition("Pending Approval", "Approved", "ADMIN"), false);
  assert.equal(transition("Pending Approval", "Draft", "OWNER"), true);
  assert.equal(transition("Pending Approval", "Approved", "OWNER"), true);
  assert.equal(transition("Approved", "Paid", "OWNER"), true);
  assert.equal(transition("Approved", "Paid", "TRAINER"), false);
  assert.equal(transition("Paid", "Draft", "OWNER"), false);
});

test("a substitute session credits only the trainer selected by policy", () => {
  const [salary] = payroll.initialSalaries([employee]);
  const session = { id: "substitute", date: "2026-11-02", status: "completed", performedBy: "replacement", assignedTrainerId: employee.id };
  const assigned = { ...employee, sessions: [session] };
  const substitute = { ...assigned, id: "replacement" };
  assert.equal(payroll.calculatePayroll(assigned, salary, period, settings, []).sessionPay, 0);
  assert.equal(payroll.calculatePayroll(substitute, salary, period, settings, []).sessionPay, 50_000);
  const policy = { ...settings, substitute: "Assigned trainer" };
  assert.equal(payroll.calculatePayroll(assigned, salary, period, policy, []).sessionPay, 50_000);
  assert.equal(payroll.calculatePayroll(substitute, salary, period, policy, []).sessionPay, 0);
});
