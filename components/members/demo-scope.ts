import { hasDemoPermission } from "@/lib/demo/roles";
import type { TenantContext } from "@/lib/tenant";

export type DemoScope = ReturnType<typeof memberDemoScope>;
export function memberDemoScope(ctx: TenantContext) {
  return {
    branchIds: ctx.branches.map(branch => branch.id),
    branchId: ctx.branch?.id ?? "",
    canView: hasDemoPermission(ctx.demoRole, "members.view"),
    canEdit: hasDemoPermission(ctx.demoRole, "members.edit"),
    canCheckIn: hasDemoPermission(ctx.demoRole, "checkin.use"),
    canManagePT: hasDemoPermission(ctx.demoRole, "pt.sessions.manage"),
    canUsePOS: hasDemoPermission(ctx.demoRole, "pos.use"),
    canViewPT: hasDemoPermission(ctx.demoRole, "pt.clients.view"),
    canManagePlan: ctx.demoRole === "OWNER" || ctx.demoRole === "ADMIN",
    staff: ctx.profile.full_name,
  };
}
