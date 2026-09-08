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

const NAV = [
  { section: null, items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" }] },
  {
    section: "Operasional",
    items: [
      { href: "/members", label: "Member", icon: Users, permission: "members.view" },
      { href: "/memberships", label: "Membership", icon: IdCard, permission: "memberships.view" },
      { href: "/check-in", label: "Check-in", icon: ScanLine, permission: "checkin.use" },
      { href: "/pos", label: "Kasir", icon: ShoppingCart, permission: "pos.use" },
    ],
  },
  {
    section: "Gym",
    items: [
      { href: "/classes", label: "Kelas", icon: Dumbbell, permission: "classes.view" },
      { href: "/coaches", label: "Coach", icon: Users2, permission: "coach.view" },
      { href: "/trainers", label: "Trainer", icon: UserCog, permission: "trainers.view" },
      { href: "/pt-clients", label: "PT Clients", icon: UserCog, permission: "pt.clients.view" },
      { href: "/equipment", label: "Peralatan", icon: Boxes, permission: "equipment.view" },
    ],
  },
  {
    section: "Keuangan",
    items: [
      { href: "/transactions", label: "Transaksi", icon: Receipt, permission: "transactions.view" },
      { href: "/reports", label: "Laporan", icon: BarChart3, permission: "reports.view" },
    ],
  },
  {
    section: "Manajemen",
    items: [
      { href: "/branches", label: "Cabang", icon: Building2, permission: "branches.view" },
      { href: "/staff", label: "Staff", icon: Users2, permission: "staff.view" },
    ],
  },
];

export function Sidebar({ ctx }: { ctx: TenantContext }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center border-b border-line px-5">
        <Link href="/dashboard" className="text-[15px] font-semibold tracking-tight text-ink">
          RepUp Gym
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group, i) => (
          <div key={i} className={cn(i > 0 && "mt-5")}>
            {group.section && group.items.some((item) => !ctx.isDemo || hasDemoPermission(ctx.demoRole, item.permission)) && (
              <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {group.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.filter((item) => !ctx.isDemo || hasDemoPermission(ctx.demoRole, item.permission)).map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-sm transition-colors",
                        active ? "bg-primary-tint text-primary font-medium" : "text-ink-muted hover:bg-canvas hover:text-ink"
                      )}
                    >
                      <Icon size={16} strokeWidth={2} />
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
          className="flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink"
        >
          <Settings size={16} />
          Pengaturan
        </Link>}
      </div>
    </aside>
  );
}
