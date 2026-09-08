import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui/layout-bits";
import { LinkButton } from "@/components/ui/button";
import { MemberStatusBadge, TransactionStatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/format";
import { ShoppingCart, ScanLine, ArrowUpRight, CalendarDays, UserPlus } from "lucide-react";
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
  if (ctx.isDemo) return <DemoDashboard ctx={ctx} />;
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
    <div className="dashboard-shell -m-6 min-h-full p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Ringkasan bisnis</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {greeting()}, {ctx.profile?.full_name?.split(" ")[0] || "Owner"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{ctx.organization.name} · {ctx.branch?.name ?? "Semua lokasi"}</p>
        </div>
        <div className="flex items-center gap-2"><select className="rounded-[6px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink" defaultValue={ctx.branch?.id ?? "all"}><option value="all">Semua lokasi</option>{ctx.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><div className="hidden rounded-[6px] border border-line-strong bg-surface p-1 sm:flex"><button className="rounded bg-primary-tint px-2.5 py-1.5 text-xs font-medium text-primary">Hari ini</button><button className="px-2.5 py-1.5 text-xs text-ink-muted">7 hari</button><button className="px-2.5 py-1.5 text-xs text-ink-muted">30 hari</button></div></div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["Total member", String(activeMembers ?? 0), "+12%", "+46 bulan ini"], ["Check-in hari ini", String(checkinsToday ?? 0), "+8%", "dari member aktif"], ["Pendapatan hari ini", formatCurrency(revenueToday, currency), "+18%", "vs periode lalu"], ["Membership akan expire", String(expiringSoon ?? 0), "", "dalam 30 hari"]].map(([label, value, delta, detail]) => <Card key={label} className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p><div className="mt-3 flex items-end justify-between gap-2"><strong className="num text-2xl font-semibold tracking-tight text-ink">{value}</strong>{delta && <span className="rounded bg-primary-tint px-1.5 py-1 text-[11px] font-medium text-primary">↑ {delta}</span>}</div><p className="mt-2 text-xs text-ink-muted">{detail}</p></Card>)}
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
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5"><div><p className="num text-3xl font-semibold text-ink">Rp14.800.000</p><p className="mt-1 text-xs text-ink-muted">Potensi pendapatan</p></div><LinkButton href="/memberships" size="sm">Buka renewal center <ArrowUpRight size={14} /></LinkButton></div>
        </Card>
        <Card>
          <div className="flex items-center justify-between border-b border-line px-5 py-3"><p className="text-sm font-medium text-ink">Quick actions</p><span className="text-xs text-ink-faint">Operasional</span></div>
          <div className="grid grid-cols-2 gap-2 p-4"><LinkButton href="/members/new" variant="secondary" size="sm"><UserPlus size={14} /> Tambah member</LinkButton><LinkButton href="/pos" variant="secondary" size="sm"><ShoppingCart size={14} /> POS / transaksi</LinkButton><LinkButton href="/classes" variant="secondary" size="sm"><CalendarDays size={14} /> Buat kelas</LinkButton><LinkButton href="/check-in" variant="secondary" size="sm"><ScanLine size={14} /> Check-in manual</LinkButton></div>
        </Card>
      </div>
    </div>
  );
}
