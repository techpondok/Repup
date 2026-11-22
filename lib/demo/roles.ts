export type DemoRole = "SUPER_ADMIN" | "SUPPORT" | "SALES" | "FINANCE" | "OWNER" | "ADMIN" | "MANAGER" | "RECEPTIONIST" | "CASHIER" | "STAFF" | "COACH" | "TRAINER" | "MEMBER";

export const DEMO_ROLES: Record<DemoRole, { name: string; scope: "platform" | "organization"; description: string; access: string; permissions: string[]; locationIds?: string[] }> = {
  SUPER_ADMIN: { name: "Super Admin", scope: "platform", description: "Explore platform operations and demo workspaces.", access: "Organizations, subscriptions, support, and system health", permissions: ["platform.dashboard", "organizations.view", "billing.view", "audit.view"] },
  SUPPORT: { name: "Support", scope: "platform", description: "Review organizations and simulated support sessions.", access: "Organization lookup, cases, and logs", permissions: ["platform.dashboard", "organizations.view", "support.view"] },
  SALES: { name: "Sales", scope: "platform", description: "Explore the pipeline for growing gym businesses.", access: "Leads, trials, organizations, and conversion", permissions: ["platform.dashboard", "leads.view", "trials.view"] },
  FINANCE: { name: "Finance", scope: "platform", description: "Review subscriptions and platform revenue.", access: "Billing, MRR, ARR, invoices, and past due", permissions: ["platform.dashboard", "billing.view", "revenue.view"] },
  OWNER: { name: "Owner", scope: "organization", description: "Explore the complete RepUp Business experience.", access: "Full gym operations, members, payments, staff, and reports", permissions: ["*" ] },
  ADMIN: { name: "Admin", scope: "organization", description: "Run day-to-day gym operations with broad access.", access: "Operations, finance, staff, and reports", permissions: ["dashboard.view", "products.manage", "inventory.manage", "members.*", "memberships.*", "classes.*", "checkin.*", "pos.use", "transactions.view", "reports.view", "staff.view", "trainers.view", "pt.clients.view", "pt.clients.manage", "pt.sessions.manage", "equipment.view", "branches.view", "settings.view"] },
  MANAGER: { name: "Manager", scope: "organization", description: "Manage one location and its performance.", access: "Surabaya members, classes, check-ins, staff, and reports", locationIds: ["demo-location-surabaya"], permissions: ["dashboard.view", "products.manage", "inventory.manage", "pos.use", "members.*", "memberships.view", "classes.*", "checkin.*", "reports.view", "staff.view", "pt.clients.view", "pt.sessions.manage"] },
  RECEPTIONIST: { name: "Receptionist", scope: "organization", description: "Keep the front desk moving quickly.", access: "Members, memberships, check-in, bookings, classes, and renewals", permissions: ["dashboard.view", "members.view", "members.edit", "memberships.view", "checkin.*", "classes.view", "bookings.*", "renewals.view", "pt.clients.view", "pt.sessions.manage"] },
  CASHIER: { name: "Cashier", scope: "organization", description: "Practice the complete checkout flow safely.", access: "POS, transactions, payments, invoices, and cashier shift", permissions: ["dashboard.view", "pos.use", "transactions.view", "payments.*"] },
  STAFF: { name: "Staff", scope: "organization", description: "Use a focused operational workspace.", access: "Member view, check-in, classes, and bookings", permissions: ["dashboard.view", "members.view", "checkin.use", "classes.view", "bookings.view"] },
  COACH: { name: "Coach", scope: "organization", description: "Focus on group classes, schedules, and attendance.", access: "My classes, class schedule, and attendance", permissions: ["dashboard.view", "coach.view", "classes.view", "profile.edit"] },
  TRAINER: { name: "Trainer", scope: "organization", description: "Kelola Personal Training, client, dan sesi individual.", access: "PT clients, PT schedule, and sessions", permissions: ["dashboard.view", "schedule.view", "clients.view", "attendance.use", "profile.edit", "pt.clients.view", "pt.sessions.manage", "trainers.view"] },
  MEMBER: { name: "Member", scope: "organization", description: "Lihat jadwal dan progress latihan Anda.", access: "Dashboard, kelas, jadwal, dan profile", permissions: ["dashboard.view", "classes.view", "profile.view"] },
};

export const DEMO_BUSINESS_ROLES: DemoRole[] = ["OWNER", "ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER", "STAFF", "COACH", "TRAINER", "MEMBER"];
export const DEMO_PLATFORM_ROLES: DemoRole[] = ["SUPER_ADMIN", "SUPPORT", "SALES", "FINANCE"];

export function getDemoRole(value: string | undefined): DemoRole {
  return value && value in DEMO_ROLES ? value as DemoRole : "OWNER";
}

export function hasDemoPermission(role: DemoRole | undefined, permission: string) {
  if (!role) return false;
  const permissions = DEMO_ROLES[role].permissions;
  return permissions.includes("*") || permissions.includes(permission) || permissions.some((item) => item.endsWith(".*") && permission.startsWith(item.slice(0, -1)));
}
