import { getTenantContext } from "@/lib/tenant";
import { BranchPerformance } from "@/components/branches/performance";
import { hasDemoPermission } from "@/lib/demo/roles";
import { EmptyState } from "@/components/ui/layout-bits";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, SectionLabel, Stat } from "@/components/ui/layout-bits";
import { RevenueChart, GrowthChart } from "@/components/reports/charts";
import { formatCurrency } from "@/lib/format";

function dayKey(d: Date) {
  return d.toISOString().slice(5, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const ctx = await getTenantContext();
  if (ctx.isDemo) return hasDemoPermission(ctx.demoRole, "reports.view") ? <BranchPerformance report /> : <EmptyState title="Reports are unavailable for this role." />;
  const sp = await searchParams;
  const supabase = await createClient();

  const days = sp.range === "7" ? 7 : sp.range === "90" ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const branchFilter = ctx.branch ? { branch_id: ctx.branch.id } : {};
  const gym = ctx.gyms.find((g) => g.id === ctx.branch?.gym_id);

  const [{ data: txns }, { data: members }, { data: checkins }, { data: memberships }] = await Promise.all([
    supabase
      .from("transactions")
      .select("total, created_at")
      .eq("organization_id", ctx.organization.id)
      .match(branchFilter)
      .eq("status", "paid")
      .gte("created_at", since.toISOString()),
    supabase
      .from("members")
      .select("join_date")
      .eq("organization_id", ctx.organization.id)
      .match(branchFilter)
      .gte("join_date", since.toISOString().slice(0, 10)),
    supabase
      .from("check_ins")
      .select("occurred_at")
      .eq("organization_id", ctx.organization.id)
      .match(branchFilter)
      .eq("status", "success")
      .gte("occurred_at", since.toISOString()),
    supabase
      .from("memberships")
      .select("status")
      .eq("organization_id", ctx.organization.id)
      .match(branchFilter),
  ]);

  const buckets: Record<string, { revenue: number; members: number; checkins: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets[dayKey(d)] = { revenue: 0, members: 0, checkins: 0 };
  }
  (txns ?? []).forEach((t: any) => {
    const k = dayKey(new Date(t.created_at));
    if (buckets[k]) buckets[k].revenue += Number(t.total);
  });
  (members ?? []).forEach((m: any) => {
    const k = dayKey(new Date(m.join_date));
    if (buckets[k]) buckets[k].members += 1;
  });
  (checkins ?? []).forEach((c: any) => {
    const k = dayKey(new Date(c.occurred_at));
    if (buckets[k]) buckets[k].checkins += 1;
  });

  const revenueData = Object.entries(buckets).map(([date, v]) => ({ date, revenue: v.revenue }));
  const growthData = Object.entries(buckets).map(([date, v]) => ({ date, members: v.members, checkins: v.checkins }));

  const totalRevenue = revenueData.reduce((s, d) => s + d.revenue, 0);
  const totalNewMembers = growthData.reduce((s, d) => s + d.members, 0);
  const totalCheckins = growthData.reduce((s, d) => s + d.checkins, 0);

  const statusCounts: Record<string, number> = {};
  (memberships ?? []).forEach((m: any) => {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
  });

  return (
    <div>
      <PageHeader
        title="Laporan"
        description={`Data ${days} hari terakhir · ${ctx.branch?.name ?? ctx.organization.name}`}
        actions={
          <div className="flex gap-1 rounded-[6px] border border-line-strong p-0.5">
            {[["7", "7 Hari"], ["30", "30 Hari"], ["90", "90 Hari"]].map(([val, label]) => (
              <a
                key={val}
                href={`/reports?range=${val}`}
                className={`rounded-[5px] px-3 py-1 text-xs font-medium ${
                  days === Number(val) ? "bg-primary text-primary-foreground" : "text-ink-muted hover:bg-canvas"
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        }
      />

      <Card statGroup className="mb-6 grid grid-cols-3">
        <Stat label="Total Pendapatan" value={formatCurrency(totalRevenue, gym?.currency)} />
        <Stat label="Member Baru" value={String(totalNewMembers)} />
        <Stat label="Total Check-in" value={String(totalCheckins)} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Tren Pendapatan</SectionLabel>
          <RevenueChart data={revenueData} />
        </Card>
        <Card className="p-5">
          <SectionLabel>Member Baru & Check-in</SectionLabel>
          <GrowthChart data={growthData} />
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <SectionLabel>Distribusi Status Membership</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Object.entries(statusCounts).length === 0 && <p className="text-sm text-ink-faint">Belum ada data.</p>}
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="rounded-md border border-line p-3 text-center">
              <p className="num text-xl font-semibold text-ink">{count}</p>
              <p className="mt-1 text-xs capitalize text-ink-faint">{status.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
