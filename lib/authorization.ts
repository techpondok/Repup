import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";

export type Permission =
  | "dashboard.view" | "members.view" | "members.edit" | "membership.sell"
  | "membership.manage" | "pos.use" | "transactions.view" | "checkin.manage"
  | "classes.manage" | "coach.manage" | "reports.view" | "staff.manage"
  | "settings.manage" | "locations.manage" | "audit.view" | "pt.clients.view"
  | "pt.clients.manage" | "pt.sessions.manage" | "pt_clients.view_all" | "pt_clients.view_own"
  | "pt_clients.create" | "pt_clients.edit" | "pt_clients.change_trainer" | "pt_clients.deactivate"
  | "pt_sessions.view_all" | "pt_sessions.view_own" | "pt_sessions.create_all" | "pt_sessions.create_own"
  | "pt_sessions.edit_all" | "pt_sessions.edit_own" | "pt_sessions.complete_own";

/** Server-side permission check. RLS remains the final database boundary. */
export async function requirePermission(permission: Permission) {
  const ctx = await getTenantContext();
  if (ctx.organization.role === "owner" || ctx.organization.role === "admin") return ctx;

  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permission_code")
    .eq("role", ctx.organization.role)
    .eq("permission_code", permission)
    .maybeSingle();

  if (!data) redirect("/dashboard?error=forbidden");
  return ctx;
}
