import { DataTable } from "@/components/ui/data-table";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { NewEquipmentForm } from "@/components/equipment/new-equipment-form";
import { formatDate } from "@/lib/format";
import { CreateFormModal } from "@/components/ui/create-form-modal";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  available: "success",
  maintenance: "warning",
  unavailable: "danger",
  retired: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  available: "Tersedia",
  maintenance: "Maintenance",
  unavailable: "Tidak Tersedia",
  retired: "Dipensiunkan",
};

export default async function EquipmentPage() {
  const ctx = await getTenantContext();
  const supabase = await createClient();

  if (!ctx.branch) {
    return <EmptyState title="Belum ada cabang" />;
  }

  const [{ data: equipment }, { data: categories }] = await Promise.all([
    supabase
      .from("equipment")
      .select("*, equipment_categories(name)")
      .eq("branch_id", ctx.branch.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("equipment_categories").select("*").order("name"),
  ]);

  return (
    <div>
      <PageHeader title="Peralatan" description={`Inventaris peralatan di ${ctx.branch.name}`} actions={<CreateFormModal title="Tambah Peralatan" description="Tambahkan inventaris gym." label="Tambah Peralatan" form={<NewEquipmentForm organizationId={ctx.organization.id} gymId={ctx.branch.gym_id} branchId={ctx.branch.id} categories={categories ?? []} />} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            {!equipment || equipment.length === 0 ? (
              <EmptyState title="Belum ada peralatan" description="Tambahkan peralatan seperti barbell, dumbbell, atau treadmill." />
            ) : (
              <DataTable className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-4 py-3 font-medium">Peralatan</th>
                    <th className="px-4 py-3 font-medium">Kategori</th>
                    <th className="px-4 py-3 font-medium">Jumlah</th>
                    <th className="px-4 py-3 font-medium">Kondisi</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((e: any) => (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{e.name}</p>
                        {e.brand && <p className="text-xs text-ink-faint">{e.brand}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{e.equipment_categories?.name ?? "-"}</td>
                      <td className="num px-4 py-3 text-ink-muted">{e.quantity}</td>
                      <td className="px-4 py-3 text-ink-muted capitalize">{e.condition}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
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
