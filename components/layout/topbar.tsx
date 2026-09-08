import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { signOut } from "@/app/actions/auth";
import type { TenantContext } from "@/lib/tenant";
import { LogOut } from "lucide-react";
import { DEMO_ROLES } from "@/lib/demo/roles";

export function Topbar({ ctx }: { ctx: TenantContext }) {
  const initials = (ctx.profile?.full_name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-ink">{ctx.organization.name}</span>
        <span className="text-line-strong">/</span>
        <BranchSwitcher branches={ctx.branches} activeBranchId={ctx.branch?.id ?? null} />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">
            {initials}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-ink">{ctx.profile?.full_name || "Pengguna"}</p>
            <p className="text-xs capitalize text-ink-faint">{ctx.isDemo ? DEMO_ROLES[ctx.demoRole ?? "OWNER"].name : ctx.organization.role}</p>
          </div>
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded-[6px] p-2 text-ink-muted hover:bg-canvas hover:text-ink" title="Keluar">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </header>
  );
}
