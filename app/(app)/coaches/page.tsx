import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { NewTrainerForm } from "@/components/trainers/new-trainer-form";
import { CreateFormModal } from "@/components/ui/create-form-modal";

export default async function CoachesPage() {
  const ctx = await getTenantContext();
  const supabase = await createClient();
  const { data: roleRows } = await supabase.from("trainer_roles").select("trainer_id").eq("role", "COACH");
  const coachIds = (roleRows ?? []).map((row: any) => row.trainer_id);
  const { data: coaches } = coachIds.length ? await supabase.from("trainers").select("*").eq("organization_id", ctx.organization.id).in("id", coachIds).is("archived_at", null).order("full_name") : { data: [] as any[] };
  return <div><PageHeader title="Coach" description="Coach untuk kelas, jadwal group, dan attendance." actions={ctx.branch ? <CreateFormModal title="Tambah Coach" description="Tambahkan coach untuk aktivitas kelas." label="Tambah Coach" form={<NewTrainerForm organizationId={ctx.organization.id} gymId={ctx.branch.gym_id} branchId={ctx.branch.id} role="COACH" />} /> : undefined} /><Card>{!coaches?.length ? <EmptyState title="Belum ada coach" /> : <table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-4 py-3">Coach</th><th className="px-4 py-3">Specialty</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{coaches.map((coach: any) => <tr key={coach.id} className="border-b border-line last:border-0"><td className="px-4 py-3 font-medium text-ink">{coach.full_name}</td><td className="px-4 py-3 text-ink-muted">{coach.specialization || "-"}</td><td className="px-4 py-3 text-ink-muted">{ctx.branch?.name || "-"}</td><td className="px-4 py-3"><Badge tone={coach.is_active ? "success" : "neutral"}>{coach.is_active ? "Aktif" : "Nonaktif"}</Badge></td></tr>)}</tbody></table>}</Card></div>;
}
