import { DataTable } from "@/components/ui/data-table";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { NewBranchForm } from "@/components/branches/new-branch-form";
import { CreateFormModal } from "@/components/ui/create-form-modal";

export default async function BranchesPage() {
  const ctx = await getTenantContext();
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("created_at");

  return (
    <div>
      <PageHeader title="Cabang" description="Kelola cabang di bawah organisasi Anda." actions={ctx.isOrgWide ? <CreateFormModal title="Tambah Cabang" description="Buat lokasi gym baru." label="Tambah Cabang" form={<NewBranchForm organizationId={ctx.organization.id} gymId={ctx.gyms[0]?.id ?? ""} />} /> : undefined} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            {!branches || branches.length === 0 ? (
              <EmptyState title="Belum ada cabang" />
            ) : (
              <DataTable className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-4 py-3 font-medium">Cabang</th>
                    <th className="px-4 py-3 font-medium">Alamat</th>
                    <th className="px-4 py-3 font-medium">Telepon</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b: any) => (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{b.name}</p>
                        <p className="num text-xs text-ink-faint">{b.code}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{b.address || "-"}</td>
                      <td className="px-4 py-3 text-ink-muted">{b.phone || "-"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={b.status === "active" ? "success" : "neutral"}>
                          {b.status === "active" ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
