import { getTenantContext } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/ui/layout-bits";
import { CheckinTerminal } from "@/components/checkin/checkin-terminal";

export default async function CheckInPage() {
  const ctx = await getTenantContext();

  if (!ctx.branch) {
    return <EmptyState title="Belum ada cabang" description="Buat cabang terlebih dahulu untuk menggunakan check-in." />;
  }

  return (
    <div>
      <PageHeader title="Check-in" description="Validasi keanggotaan member saat masuk ke gym." />
      <CheckinTerminal organizationId={ctx.organization.id} branchId={ctx.branch.id} branchName={ctx.branch.name} />
    </div>
  );
}
