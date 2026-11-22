import { getTenantContext } from "@/lib/tenant";
import { PageHeader, EmptyState } from "@/components/ui/layout-bits";
import { CheckinTerminal } from "@/components/checkin/checkin-terminal";
import { getActiveVisits, getRecentAttendance } from "@/app/actions/checkin";
import { DemoCheckinTerminal } from "@/components/checkin/demo-checkin-terminal";
import { hasDemoPermission } from "@/lib/demo/roles";

export default async function CheckInPage() {
  const ctx = await getTenantContext();

  if (!ctx.branch) {
    return <EmptyState title="Belum ada cabang" description="Buat cabang terlebih dahulu untuk menggunakan check-in." />;
  }

  const props = { organizationId: ctx.organization.id, branchId: ctx.branch.id, branchName: ctx.branch.name };
  if (ctx.isDemo && !hasDemoPermission(ctx.demoRole, "checkin.use") && !hasDemoPermission(ctx.demoRole, "checkin.manage")) {
    return <EmptyState title="Akses Check-in tidak tersedia untuk peran ini" />;
  }

  const [recent, active] = ctx.isDemo ? [] : await Promise.allSettled([
    getRecentAttendance(ctx.branch.id), getActiveVisits(ctx.branch.id),
  ]);

  return (
    <div>
      <PageHeader title="Check-in" description="Validasi keanggotaan member saat masuk ke gym." />
      {ctx.isDemo ? <DemoCheckinTerminal {...props} /> : <CheckinTerminal {...props}
        initialRecent={recent?.status === "fulfilled" ? recent.value : []}
        initialActive={active?.status === "fulfilled" ? active.value : []}
        historyUnavailable={recent?.status === "rejected"} activeUnavailable={active?.status === "rejected"} />}
    </div>
  );
}
