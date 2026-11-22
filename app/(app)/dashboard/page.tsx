import Link from "next/link";
import { BranchPerformance } from "@/components/branches/performance";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, StatCard, AnalyticsCard } from "@/components/ui/layout-bits";
import { RevenueChart } from "@/components/reports/charts";
import { LinkButton } from "@/components/ui/button";
import { MemberStatusBadge, TransactionStatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/format";
import { ShoppingCart, ScanLine, ArrowUpRight, CalendarDays, UserPlus, Users, Wallet, IdCard } from "lucide-react";
import DemoDashboard from "@/components/demo-dashboard";

function greeting() {
  const hour = new Date().getUTCHours() + 7; // Asia/Jakarta approx
  const h = hour % 24;
  if (h < 11) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
}

export default async function DashboardPage() {
  const ctx = await getTenantContext();
  if (ctx.isDemo) return ctx.demoRole === "COACH" || ctx.demoRole === "TRAINER" ? <DemoDashboard ctx={ctx} /> : <BranchPerformance />;
  const supabase = await createClient();
  const gym = ctx.gyms.find((g) => g.id === ctx.branch?.gym_id);
  const currency = gym?.currency ?? "IDR";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const branchFilter = ctx.branch ? { branch_id: ctx.branch.id } : {};

  const [{ count: checkinsToday }, { count: activeMembers }, { count: expiringSoon }, { data: todaysTxns }, { data: recentCheckins }, { data: recentTxns }] =
    await Promise.all([
      supabase
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", ctx.organization.id)
        .match(branchFilter)
        .eq("status", "success")
        .gte("occurred_at", todayIso),
      supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", ctx.organization.id)
        .match(branchFilter)
        .eq("status", "active"),
      supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", ctx.organization.id)
        .match(branchFilter)
        .eq("status", "expiring_soon"),
      supabase
        .from("transactions")
        .select("total")
        .eq("organization_id", ctx.organization.id)
        .match(branchFilter)
        .eq("status", "paid")
        .gte("created_at", todayIso),
      supabase
        .from("check_ins")
        .select("*, members(full_name)")
        .eq("organization_id", ctx.organization.id)
        .match(branchFilter)
        .order("occurred_at", { ascending: false })
        .limit(6),
      supabase
        .from("transactions")
        .select("*, members(full_name)")
        .eq("organization_id", ctx.organization.id)
        .match(branchFilter)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const revenueToday = (todaysTxns ?? []).reduce((s, t: any) => s + Number(t.total), 0);

  return (
    <div className="dashboard-shell min-h-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Ringkasan bisnis</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {greeting()}, {ctx.profile?.full_name?.split(" ")[0] || "Owner"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{ctx.organization.name} · {ctx.branch?.name ?? "Semua lokasi"}</p>
        </div>
        <LinkButton href="/reports" variant="secondary" size="sm">Lihat laporan <ArrowUpRight size={14} /></LinkButton>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Member aktif" value={String(activeMembers ?? 0)} detail="Membership aktif di lokasi terpilih" icon={<Users size={18} />} />
        <StatCard label="Check-in hari ini" value={String(checkinsToday ?? 0)} detail="Check-in berhasil hari ini" icon={<ScanLine size={18} />} />
        <StatCard label="Pendapatan hari ini" value={formatCurrency(revenueToday, currency)} detail={`${todaysTxns?.length ?? 0} transaksi lunas`} icon={<Wallet size={18} />} />
        <StatCard label="Membership segera berakhir" value={String(expiringSoon ?? 0)} detail="Perlu tindak lanjut perpanjangan" icon={<IdCard size={18} />} />
      </div>

      <div className="mb-6 grid min-w-0 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <AnalyticsCard title="Pendapatan hari ini" description="Nilai setiap transaksi lunas hari ini" action={<span className="num text-sm font-semibold text-ink">{formatCurrency(revenueToday, currency)}</span>}>
          {todaysTxns?.length ? <RevenueChart data={todaysTxns.map((transaction, index) => ({ date: String(index + 1), revenue: Number(transaction.total) }))} /> : <EmptyState title="Belum ada pendapatan hari ini" description="Grafik muncul setelah transaksi pertama lunas." />}
        </AnalyticsCard>
        <AnalyticsCard title="Rincian pendapatan" description="Transaksi lunas dari 6 transaksi terbaru">
          <div className="space-y-6">{["Member", "Walk-in"].map((label) => {
            const paid = (recentTxns ?? []).filter((transaction) => transaction.status === "paid");
            const amount = paid.filter((transaction) => label === "Member" ? Boolean(transaction.members) : !transaction.members).reduce((sum, transaction) => sum + Number(transaction.total), 0);
            const total = paid.reduce((sum, transaction) => sum + Number(transaction.total), 0);
            return <div key={label}><div className="mb-3 flex flex-wrap justify-between gap-2 text-sm"><span className="text-ink-muted">{label}</span><span className="num font-semibold text-ink">{formatCurrency(amount, currency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-elevated"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? amount / total * 100 : 0}%` }} /></div></div>;
          })}<Link href="/reports" className="inline-flex items-center gap-2 text-sm text-primary">Buka laporan lengkap <ArrowUpRight size={14} /></Link></div>
        </AnalyticsCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-sm font-medium text-ink">Check-in Terbaru</p>
            <Link href="/check-in" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {!recentCheckins || recentCheckins.length === 0 ? (
            <EmptyState title="Belum ada check-in" />
          ) : (
            <div className="divide-y divide-line">
              {recentCheckins.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{c.members?.full_name ?? "-"}</p>
                    <p className="text-xs text-ink-faint">{formatTime(c.occurred_at)}</p>
                  </div>
                  <MemberStatusBadge status={c.status === "success" ? "active" : "expired"} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-sm font-medium text-ink">Transaksi Terbaru</p>
            <Link href="/transactions" className="text-xs text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {!recentTxns || recentTxns.length === 0 ? (
            <EmptyState title="Belum ada transaksi" />
          ) : (
            <div className="divide-y divide-line">
              {recentTxns.map((t: any) => (
                <Link
                  key={t.id}
                  href={`/transactions/${t.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-canvas"
                >
                  <div>
                    <p className="num font-medium text-ink">{t.invoice_number}</p>
                    <p className="text-xs text-ink-faint">{t.members?.full_name ?? "Walk-in"} · {formatDateTime(t.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num font-medium">{formatCurrency(t.total, currency)}</span>
                    <TransactionStatusBadge status={t.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3"><div><p className="text-sm font-medium text-ink">Renewal opportunity</p><p className="mt-0.5 text-xs text-ink-muted">Membership yang perlu ditindaklanjuti</p></div><span className="rounded bg-primary-tint px-2 py-1 text-xs font-medium text-primary">{expiringSoon ?? 0} due</span></div>
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5"><div><p className="num text-3xl font-semibold text-ink">{expiringSoon ?? 0}</p><p className="mt-1 text-xs text-ink-muted">Membership segera berakhir</p></div><LinkButton href="/memberships" size="sm">Tinjau membership <ArrowUpRight size={14} /></LinkButton></div>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3"><p className="text-sm font-medium text-ink">Quick actions</p><span className="text-xs text-ink-faint">Operasional</span></div>
          <div className="grid grid-cols-2 gap-2 p-4"><LinkButton href="/members/new" variant="secondary" size="sm"><UserPlus size={14} /> Tambah member</LinkButton><LinkButton href="/pos" variant="secondary" size="sm"><ShoppingCart size={14} /> POS / transaksi</LinkButton><LinkButton href="/classes" variant="secondary" size="sm"><CalendarDays size={14} /> Buat kelas</LinkButton><LinkButton href="/check-in" variant="secondary" size="sm"><ScanLine size={14} /> Check-in manual</LinkButton></div>
        </Card>
      </div>
    </div>
  );
}
