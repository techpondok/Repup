import { getTenantContext } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/ui/layout-bits";
import { CheckinTerminal } from "@/components/checkin/checkin-terminal";
import { getActiveVisits, getRecentAttendance } from "@/app/actions/checkin";

export default async function CheckInPage() {
  const ctx = await getTenantContext();

  if (!ctx.branch) {
    return <EmptyState title="Belum ada cabang" description="Buat cabang terlebih dahulu untuk menggunakan check-in." />;
  }

  const [recent, active] = await Promise.all([getRecentAttendance(ctx.branch.id), getActiveVisits(ctx.branch.id)]);

  return (
    <div>
      <PageHeader title="Check-in" description="Validasi keanggotaan member saat masuk ke gym." />
      <CheckinTerminal organizationId={ctx.organization.id} branchId={ctx.branch.id} branchName={ctx.branch.name} initialRecent={recent} initialActive={active} />
    </div>
  );
}
