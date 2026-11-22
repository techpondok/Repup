"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { TenantContext } from "@/lib/tenant";
import { hasDemoPermission } from "@/lib/demo/roles";
import {
  LayoutDashboard,
  Users,
  IdCard,
  ScanLine,
  ShoppingCart,
  Dumbbell,
  UserCog,
  Boxes,
  Receipt,
  BarChart3,
  Building2,
  Users2,
  Settings,
} from "lucide-react";

export const NAV = [
  { section: null, items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" }] },
  {
    section: "Operasional",
    items: [
      { href: "/members", label: "Member", icon: Users, permission: "members.view" },
      { href: "/memberships", label: "Membership", icon: IdCard, permission: "memberships.view" },
      { href: "/check-in", label: "Check-in", icon: ScanLine, permission: "checkin.use" },
      { href: "/products", label: "Products", icon: Boxes, permission: "products.manage" },
      { href: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory.manage" },
      { href: "/pos/orders", label: "Store Orders", icon: Receipt, permission: "pos.use" },
      { href: "/pos/pickup", label: "Store Pickup", icon: ScanLine, permission: "pos.use" },
      { href: "/pos", label: "Kasir", icon: ShoppingCart, permission: "pos.use" },
    ],
  },
  {
    section: "Gym",
    items: [
      { href: "/classes", label: "Kelas", icon: Dumbbell, permission: "classes.view" },
      { href: "/coaches", label: "Coach", icon: Users2, permission: "coach.view" },
      { href: "/trainers", label: "Trainer", icon: UserCog, permission: "trainers.view" },
      { href: "/pt-attendance", label: "PT Attendance", icon: ScanLine, permission: "pt.sessions.manage" },
      { href: "/pt-clients", label: "PT Clients", icon: UserCog, permission: "pt.clients.view" },
      { href: "/equipment", label: "Peralatan", icon: Boxes, permission: "equipment.view" },
    ],
  },
  {
    section: "Keuangan",
    items: [
      { href: "/transactions", label: "Transaksi", icon: Receipt, permission: "transactions.view" },
      { href: "/dashboard/payroll", label: "Payroll", icon: Receipt, permission: "payroll.view" },
      { href: "/reports", label: "Laporan", icon: BarChart3, permission: "reports.view" },
    ],
  },
  {
    section: "Manajemen",
    items: [
      { href: "/branches", label: "Cabang", icon: Building2, permission: "branches.view" },
      { href: "/staff", label: "Staff", icon: Users2, permission: "staff.view" },
      { href: "/devices", label: "Devices", icon: ScanLine, permission: "settings.view" },
    ],
  },
];

export function Sidebar({ ctx }: { ctx: TenantContext }) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-canvas lg:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-6">
        <Link href="/dashboard" className="flex items-baseline gap-2 text-2xl font-bold tracking-tight text-ink" aria-label="RepUp Gym dashboard">
          <span>Rep<span className="text-primary">Up</span><span className="text-primary">.</span></span><span className="text-xs font-medium tracking-normal text-ink-muted">Gym</span>
        </Link>
      </div>

      <nav aria-label="Navigasi utama" className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        {NAV.map((group, i) => (
          <div key={i} className={cn(i > 0 && "mt-5")}>
            {group.section && group.items.some((item) => !ctx.isDemo || hasDemoPermission(ctx.demoRole, item.permission)) && (
              <p className="mb-2 px-3 text-xs font-medium text-ink-faint">
                {group.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.filter((item) => !ctx.isDemo || hasDemoPermission(ctx.demoRole, item.permission)).map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active ? "bg-surface text-ink font-semibold before:absolute before:left-0 before:h-4 before:w-[3px] before:rounded-full before:bg-primary" : "text-ink-muted hover:bg-surface hover:text-ink"
                      )}
                    >
                      <Icon size={17} strokeWidth={1.8} className={active ? "text-primary" : undefined} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        {(!ctx.isDemo || hasDemoPermission(ctx.demoRole, "settings.view")) && <Link
          href="/settings"
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm hover:bg-surface hover:text-ink", pathname === "/settings" ? "bg-surface text-primary" : "text-ink-muted")}
        >
          <Settings size={16} />
          Pengaturan
        </Link>}
      </div>
    </aside>
  );
}

export const AppSidebar = Sidebar;
