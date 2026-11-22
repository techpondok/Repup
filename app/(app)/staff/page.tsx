import { DataTable } from "@/components/ui/data-table";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { InviteStaffForm } from "@/components/staff/invite-staff-form";
import { DemoStaffWorkspace } from "@/components/staff/demo-workspace";
import { hasDemoPermission } from "@/lib/demo/roles";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Branch Manager",
  cashier: "Cashier",
  trainer: "Trainer",
  staff: "Staff",
};

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const ctx = await getTenantContext();
  if (ctx.isDemo) {
    if (!hasDemoPermission(ctx.demoRole, "staff.view")) {
      return <><PageHeader title="Staff" /><EmptyState title="Akses daftar staff tidak tersedia untuk role ini" /></>;
    }
    return <DemoStaffWorkspace branches={ctx.branches} canCreate={ctx.isOrgWide} branchId={(await searchParams).branch} />;
  }

  const { data: staff } = await (await createClient())
        .from("organization_users")
        .select("*, profiles(full_name)")
        .eq("organization_id", ctx.organization.id)
        .order("created_at");

  return (
    <div>
      <PageHeader title="Staff" description="Kelola staff dan akses cabang mereka." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            {!staff || staff.length === 0 ? (
              <EmptyState title="Belum ada staff" />
            ) : (
              <DataTable className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-4 py-3 font-medium">Nama</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s: any) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 text-ink">
                        {s.profiles?.full_name || s.invited_email || "-"}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{ROLE_LABEL[s.role] ?? s.role}</td>
                      <td className="px-4 py-3">
                        <Badge tone={s.status === "active" ? "success" : "warning"}>
                          {s.status === "active" ? "Aktif" : "Diundang"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
        </div>

        {ctx.isOrgWide && (
          <Card className="h-fit p-5">
            <p className="mb-4 text-sm font-medium text-ink">Undang Staff</p>
            <InviteStaffForm organizationId={ctx.organization.id} />
          </Card>
        )}
      </div>
    </div>
  );
}
