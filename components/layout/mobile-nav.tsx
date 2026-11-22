"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, LayoutDashboard, MoreHorizontal, ScanLine, Settings, Users, X } from "lucide-react";
import { NAV } from "@/components/layout/sidebar";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { signOut } from "@/app/actions/auth";
import { hasDemoPermission } from "@/lib/demo/roles";
import type { TenantContext } from "@/lib/tenant";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Member", icon: Users },
  { href: "/check-in", label: "Check-in", icon: ScanLine },
];

function activePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({ ctx }: { ctx: TenantContext }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const initials = (ctx.profile?.full_name || "U").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const title = pathname === "/dashboard" ? "Dashboard" : pathname.split("/").filter(Boolean)[0]?.replace(/-/g, " ") || "RepUp Business";

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLElement>("button, a[href], select")?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const controls = menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", close); previousFocus?.focus(); };
  }, [open]);

  const visibleGroups = NAV.map((group) => ({ ...group, items: group.items.filter((item) => !ctx.isDemo || hasDemoPermission(ctx.demoRole, item.permission)) })).filter((group) => group.items.length);

  return <>
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-black text-primary-foreground">R</span><span className="truncate text-sm font-semibold text-ink">{title}</span></Link>
      <div className="flex items-center gap-1"><Link href="/dashboard" aria-label="Lihat aktivitas terbaru" className="rounded-md p-2 text-ink-muted hover:bg-canvas"><Bell size={18} /></Link><button type="button" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">{initials}</button></div>
    </header>

    {open && <div className="fixed inset-0 z-[60] bg-black/60 lg:hidden" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><aside ref={menuRef} className="flex h-full w-[min(88vw,22rem)] flex-col border-r border-line bg-surface shadow-2xl" role="dialog" aria-modal="true" aria-label="Menu utama"><div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5"><div><p className="text-sm font-semibold text-ink">RepUp Business</p><p className="mt-0.5 text-xs text-ink-faint">{ctx.organization.name}</p></div><button type="button" aria-label="Tutup menu" onClick={() => setOpen(false)} className="rounded-md p-2 text-ink-muted hover:bg-canvas"><X size={19} /></button></div><div className="border-b border-line px-5 py-3"><p className="mb-2 text-[11px] font-medium text-ink-faint">Cabang aktif</p><BranchSwitcher branches={ctx.branches} activeBranchId={ctx.branch?.id ?? null} /></div><nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{visibleGroups.map((group, index) => <div key={index} className={cn(index > 0 && "mt-5")}>{group.section && <p className="mb-1.5 px-2 text-[11px] font-medium text-ink-faint">{group.section}</p>}<ul className="space-y-1">{group.items.map((item) => { const Icon = item.icon; const active = activePath(pathname, item.href); return <li key={item.href}><Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm", active ? "bg-primary-tint font-medium text-primary" : "text-ink-muted hover:bg-canvas hover:text-ink")}><Icon size={17} />{item.label}<ChevronRight size={14} className="ml-auto opacity-40" /></Link></li>; })}</ul></div>)}</nav><div className="shrink-0 border-t border-line p-4">{(!ctx.isDemo || hasDemoPermission(ctx.demoRole, "settings.view")) && <Link href="/settings" onClick={() => setOpen(false)} className="mb-3 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-ink-muted hover:bg-canvas"><Settings size={17} />Pengaturan</Link>}<p className="mb-3 text-sm font-medium text-ink">{ctx.profile?.full_name || "Pengguna"}</p><form action={signOut}><button type="submit" className="min-h-10 w-full rounded-md border border-line-strong px-3 text-left text-sm text-ink-muted hover:bg-canvas">Keluar</button></form></div></aside></div>}

    <nav className="fixed inset-x-0 bottom-0 z-40 grid min-h-16 grid-cols-4 border-t border-line bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden" aria-label="Navigasi utama">{PRIMARY.filter((item) => !ctx.isDemo || hasDemoPermission(ctx.demoRole, item.href === "/members" ? "members.view" : item.href === "/check-in" ? "checkin.use" : "dashboard.view")).map((item) => { const Icon = item.icon; const active = activePath(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 text-[10px]", active ? "font-semibold text-primary" : "text-ink-faint")}><Icon size={19} strokeWidth={active ? 2.4 : 2} /><span className="truncate">{item.label}</span></Link>; })}<button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] text-ink-faint"><MoreHorizontal size={19} /><span>Lainnya</span></button></nav>
  </>;
}
