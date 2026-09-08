import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { NewTrainerForm } from "@/components/trainers/new-trainer-form";
import { CreateFormModal } from "@/components/ui/create-form-modal";
import Link from "next/link";

export default async function TrainersPage() {
  const ctx = await getTenantContext();
  const supabase = await createClient();

  const { data: roleRows } = await supabase.from("trainer_roles").select("trainer_id").eq("role", "TRAINER");
  const trainerIds = (roleRows ?? []).map((row: any) => row.trainer_id);
  const { data: trainers } = trainerIds.length ? await supabase
    .from("trainers")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .is("archived_at", null)
    .in("id", trainerIds).order("created_at", { ascending: false }) : { data: [] as any[] };

  return (
    <div>
      <PageHeader title="Trainer" description="Personal Training, PT clients, dan sesi individual." actions={<div className="flex items-center gap-2"><Link href="/pt-clients" className="rounded-[6px] border border-line-strong px-3 py-2 text-sm text-ink-muted hover:bg-canvas">PT Clients</Link>{ctx.branch ? <CreateFormModal title="Tambah Trainer" description="Tambahkan trainer Personal Training ke cabang ini." label="Tambah Trainer" form={<NewTrainerForm organizationId={ctx.organization.id} gymId={ctx.branch.gym_id} branchId={ctx.branch.id} role="TRAINER" />} /> : undefined}</div>} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            {!trainers || trainers.length === 0 ? (
              <EmptyState title="Belum ada trainer" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-4 py-3 font-medium">Trainer</th>
                    <th className="px-4 py-3 font-medium">Spesialisasi</th>
                    <th className="px-4 py-3 font-medium">Tipe</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((t: any) => (
                    <tr key={t.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium text-ink">{t.full_name}</td>
                      <td className="px-4 py-3 text-ink-muted">{t.specialization || "-"}</td>
                      <td className="px-4 py-3 text-ink-muted capitalize">{t.employment_type}</td>
                      <td className="px-4 py-3">
                        <Badge tone={t.is_active ? "success" : "neutral"}>{t.is_active ? "Aktif" : "Nonaktif"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
