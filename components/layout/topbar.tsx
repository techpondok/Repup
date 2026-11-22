import { GymSwitcher } from "@/components/layout/gym-switcher";
import { signOut } from "@/app/actions/auth";
import type { TenantContext } from "@/lib/tenant";
import { Bell, LogOut } from "lucide-react";
import { DEMO_ROLES } from "@/lib/demo/roles";

export function Topbar({ ctx }: { ctx: TenantContext }) {
  const initials = (ctx.profile?.full_name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="app-header sticky top-0 z-30 hidden h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-canvas px-8 lg:flex">
      <GymSwitcher ctx={ctx} />

      <div className="flex shrink-0 items-center gap-4">
        <details className="relative">
          <summary aria-label="Notifikasi" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink"><Bell size={18} /></summary>
          <div className="absolute right-0 top-12 w-72 rounded-xl border border-line bg-surface p-4 shadow-xl"><p className="text-sm font-semibold text-ink">Pusat notifikasi</p><p className="mt-2 text-xs leading-relaxed text-ink-muted">Pantau membership yang segera berakhir dan aktivitas terbaru melalui dashboard.</p><a href="/dashboard" className="mt-3 inline-block text-xs font-medium text-primary">Buka dashboard →</a></div>
        </details>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-xs font-semibold text-ink">
            {initials}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-ink">{ctx.profile?.full_name || "Pengguna"}</p>
            <p className="text-xs capitalize text-ink-faint">{ctx.isDemo ? DEMO_ROLES[ctx.demoRole ?? "OWNER"].name : ctx.organization.role}</p>
          </div>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-lg p-2.5 text-ink-muted hover:bg-surface hover:text-ink" title="Keluar" aria-label="Keluar">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}

export const AppHeader = Topbar;
