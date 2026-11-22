import type { TrainerDetail } from "@/lib/trainer-management";
import type { DemoStaff } from "./staff";
import { trainerBranchIds } from "./branches";

export const salaryTypes = ["Monthly Salary", "Daily Wage", "Hourly Wage", "Per Session", "Commission Based", "Mixed Salary"] as const;
export const allowanceTypes = ["Transport Allowance", "Meal Allowance", "Attendance Bonus", "Performance Bonus", "Sales Incentive", "Holiday Allowance / THR", "Custom Allowance"];
export const deductionTypes = ["Unpaid Leave", "Salary Advance", "Employee Loan Installment", "Authorized Absence Deduction", "Tax", "BPJS", "Other Deduction"];
export const statuses = ["Draft", "Pending Approval", "Approved", "Paid", "Cancelled"] as const;
export type Status = (typeof statuses)[number];
export type Component = { type: string; amount: number; reason: string; period: string; calculation: "Fixed" | "Variable" };
type CommissionSession = { id: string; date: string; status: string; performedBy?: string; assignedTrainerId?: string };
export type Employee = { id: string; name: string; code: string; photo: string | null; position: string; employment: string; branch: string; weekdays: number[]; timeOff?: string[]; sessions: CommissionSession[] };
export type Salary = { employeeId: string; effective: string; type: (typeof salaryTypes)[number]; base: number; schedule: string; sessionRate: number; salesRate: number; bank: string; allowances: Component[]; deductions: Component[] };
export const defaultSettings = { period: "Monthly", cutoff: 25, payment: 28, workdays: 5, hours: 8, overtimeRate: 0, lateRate: 0, commissionMode: "Sessions", substitute: "Session trainer", approval: "Owner approval", payslipNote: "Payroll simulation", thr: "Manual", bpjs: "Manual", tax: "Manual" };
export const demoPeriod = "2026-11";
export type Settings = typeof defaultSettings;
export type Attendance = { date: string; in: string; out: string; status: "Present" | "Absent" | "Late" | "Leave" | "Overtime"; overtime: number };
export type Payroll = ReturnType<typeof calculatePayroll> & { adjustmentOf?: string; reviewNote?: string };

export function payrollEmployees(trainers: TrainerDetail[], staff: DemoStaff[]): Employee[] {
  const sessions = trainers.flatMap(detail => detail.sessions.map(session => ({ ...session, performedBy: detail.trainer.id })));
  const managedTrainers: Employee[] = trainers.map(({ trainer }) => ({
    id: trainer.id, name: trainer.name, code: trainer.code, photo: trainer.photo, position: "Personal Trainer",
    employment: trainer.employment, branch: trainerBranchIds(trainer.id, trainer.branchIds)[0] ?? "",
    weekdays: [...new Set(trainer.availability?.weekly.filter(slot => slot.kind === "available").map(slot => slot.day) ?? [])],
    timeOff: trainer.availability?.timeOff.map(day => day.date),
    sessions: sessions.filter(session => session.performedBy === trainer.id || session.assignedTrainerId === trainer.id),
  }));
  return [...managedTrainers, ...staff.map(({ id, code, name, position, employment, branch, weekdays }) => ({
    id, code, name, position, employment, branch, weekdays, photo: null, sessions: [],
  }))];
}

export function initialSalaries(employees: Employee[]): Salary[] {
  return employees.map(employee => {
    const sarah = employee.id === "demo-trainer-2";
    const andika = employee.id === "demo-trainer-1";
    return {
      employeeId: employee.id, effective: "2026-01-01", type: sarah || andika ? "Mixed Salary" : employee.position === "Gym Staff" ? "Daily Wage" : "Monthly Salary",
      base: sarah ? 2000000 : andika ? 2500000 : employee.position === "Gym Staff" ? 150000 : 3500000, schedule: "Monthly", bank: "",
      sessionRate: sarah ? 50000 : andika ? 60000 : 0, salesRate: 0,
      allowances: [{ type: "Transport Allowance", amount: andika ? 250000 : 300000, reason: "Demo transport allowance", period: "", calculation: "Fixed" }],
      deductions: [{ type: "Other Deduction", amount: andika ? 150000 : 100000, reason: "Demo approved adjustment", period: "", calculation: "Fixed" }],
    };
  });
}

export function periodDate(period: string, day: number) {
  const [year, month] = period.split("-").map(Number);
  return `${period}-${String(Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())).padStart(2, "0")}`;
}

export function attendanceFor(employee: Employee, period: string, settings: Settings): Attendance[] {
  const cutoff = Number(periodDate(period, settings.cutoff).slice(-2));
  return Array.from({ length: cutoff }, (_, index): Attendance | null => {
    const date = periodDate(period, index + 1);
    const weekdays = employee.weekdays.length ? employee.weekdays : Array.from({ length: settings.workdays }, (_, day) => (day + 1) % 7);
    if (!weekdays.includes(new Date(date).getUTCDay())) return null;
    const status = employee.timeOff?.includes(date) || index === 3 ? "Leave" : index === 2 ? "Late" : index === 4 ? "Overtime" : index === 11 ? "Absent" : "Present";
    return { date, in: status === "Leave" || status === "Absent" ? "" : status === "Late" ? "08:30" : "08:00",
      out: status === "Leave" || status === "Absent" ? "" : status === "Overtime" ? "19:00" : "17:00",
      status, overtime: status === "Overtime" ? 2 : 0 };
  }).filter(row => row !== null);
}

export function calculatePayroll(employee: Employee, salary: Salary, period: string, settings: Settings, attendance: Attendance[], sales = 0, status: Status = "Draft") {
  const present = attendance.filter(row => ["Present", "Late", "Overtime"].includes(row.status)).length;
  const late = attendance.filter(row => row.status === "Late").length;
  const hours = attendance.reduce((total, row) => total + row.overtime, 0);
  const eligibleSessions = employee.sessions.filter(session => {
    const performingTrainer = session.performedBy ?? employee.id;
    const recipient = settings.substitute === "Assigned trainer" ? session.assignedTrainerId ?? performingTrainer : performingTrainer;
    return recipient === employee.id && session.status === "completed" && session.date.startsWith(period) && session.date <= periodDate(period, settings.cutoff);
  });
  const sessions = [...new Map(eligibleSessions.map(session => [session.id, session])).values()];
  const trainer = employee.position === "Personal Trainer";
  const sessionPay = trainer && (settings.commissionMode !== "Sales" || salary.type === "Per Session") ? sessions.length * (salary.type === "Per Session" ? salary.base : salary.sessionRate) : 0;
  const salesPay = trainer && settings.commissionMode !== "Sessions" ? Math.round(sales * salary.salesRate / 100) : 0;
  const basic = salary.type === "Daily Wage" ? salary.base * present : salary.type === "Hourly Wage" ? salary.base * present * settings.hours : ["Per Session", "Commission Based"].includes(salary.type) ? 0 : salary.base;
  const allowances = salary.allowances.filter(item => !item.period || item.period === period);
  const deductions = salary.deductions.filter(item => !item.period || item.period === period);
  if (late && settings.lateRate) deductions.push({ type: "Late Deduction", amount: late * settings.lateRate, reason: `${late} late arrivals × configured rate`, period, calculation: "Variable" });
  const allowance = allowances.reduce((total, item) => total + item.amount, 0);
  const deduction = deductions.reduce((total, item) => total + item.amount, 0);
  const overtime = hours * settings.overtimeRate;
  const gross = basic + allowance + sessionPay + salesPay + overtime;
  return { id: `${employee.id}-${period}`, employee: { ...employee, sessions: [] }, period, status, cutOff: periodDate(period, settings.cutoff),
    payment: periodDate(period, settings.payment), note: settings.payslipNote, basic, allowance, deduction, overtime, sessionPay, salesPay, sales,
    gross, net: gross - deduction, allowances, deductions, attendance, sessions, salary, settings, commissionRecipientRule: settings.substitute };
}

export function transitionPayroll(status: Status, next: Status, role: string) {
  if (role !== "OWNER" && role !== "ADMIN") return false;
  if (status === "Draft") return next === "Pending Approval" || next === "Cancelled";
  if (role !== "OWNER") return false;
  return (status === "Pending Approval" && (next === "Approved" || next === "Draft")) || (status === "Approved" && next === "Paid");
}
