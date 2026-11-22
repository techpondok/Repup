import { Building2, MapPin } from "lucide-react";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import type { TenantContext } from "@/lib/tenant";

export function GymSwitcher({ ctx }: { ctx: TenantContext }) {
  return <div className="flex min-w-0 items-center gap-4"><Building2 size={18} className="shrink-0 text-ink-muted" aria-hidden="true" /><span className="max-w-48 truncate text-sm font-semibold text-ink">{ctx.organization.name}</span><span className="h-5 border-l border-line" /><div className="flex min-w-0 items-center gap-2" role="group" aria-label="Lokasi gym"><MapPin size={15} className="shrink-0 text-ink-faint" aria-hidden="true" /><BranchSwitcher branches={ctx.branches} activeBranchId={ctx.branch?.id ?? null} /></div></div>;
}
