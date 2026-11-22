import { LivePurchaseHistory } from "@/components/members/purchase-history";
import { DemoMemberDetail } from "@/components/members/demo-detail";
import { memberDemoScope } from "@/components/members/demo-scope";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, SectionLabel, EmptyState } from "@/components/ui/layout-bits";
import { MemberStatusBadge, MembershipStatusBadge, TransactionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PairingCodeButton } from "@/components/members/pairing-code-button";

export default async function MemberDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const requestedTab = (await searchParams).tab;
  const tabs = [["overview", "Overview"], ["membership", "Membership"], ["attendance", "Attendance"], ["purchases", "Purchase History"]];
  const tab = tabs.some(([key]) => key === requestedTab) ? requestedTab : "overview";
  const navigation = <nav aria-label="Member detail" className="mb-5 flex flex-wrap gap-x-5 gap-y-2 border-b border-line pb-3 text-sm">
    {tabs.map(([key, label]) => <Link key={key} href={`/members/${id}?tab=${key}`} aria-current={tab === key ? "page" : undefined} className={tab === key ? "py-2 font-medium text-primary" : "py-2 text-ink-muted hover:text-ink"}>{label}</Link>)}
  </nav>;
  if (ctx.isDemo) return <DemoMemberDetail {...memberDemoScope(ctx)} id={id} requestedTab={requestedTab} />;
  const supabase = await createClient();

  const { data: member } = await supabase.from("members").select("*").eq("id", id).eq("organization_id", ctx.organization.id).single();
  if (!member) notFound();

  const [{ data: memberships }, { data: transactions }, { data: checkins }, { data: repupProfile }] = await Promise.all([
    tab === "membership" ? supabase.from("memberships").select("*, membership_plans(name)")
      .eq("member_id", id).order("created_at", { ascending: false }) : { data: null },
    tab === "overview" ? supabase.from("transactions").select("*").eq("organization_id", ctx.organization.id)
      .eq("member_id", id).order("created_at", { ascending: false }).limit(10) : { data: null },
    tab === "attendance" ? supabase.from("check_ins").select("*")
      .eq("member_id", id).order("occurred_at", { ascending: false }).limit(10) : { data: null },
    member.repup_account_id ? supabase.from("profiles").select("id, full_name, phone, avatar_url, created_at")
      .eq("id", member.repup_account_id).maybeSingle() : { data: null },
  ]);

  const branch = ctx.branches.find((b) => b.id === member.branch_id);

  return (
    <div>
      <PageHeader
        title={repupProfile?.full_name ?? member.full_name}
        description={`${member.member_code} · Bergabung ${formatDate(member.join_date)} · ${branch?.name ?? ""}`}
        actions={
          <LinkButton href={`/pos?member=${member.id}`}>
            <ShoppingCart size={16} /> Buat Transaksi
          </LinkButton>
        }
      />

      {navigation}
      {tab === "purchases" ? <LivePurchaseHistory key={id} memberId={id} /> : (
      <div id="overview" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div hidden={tab !== "overview"}><Card className="p-5">
          <SectionLabel>Overview</SectionLabel>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-faint">Status</dt>
              <dd>
                <MemberStatusBadge status={member.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Telepon</dt>
              <dd className="text-ink">{member.phone || "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Email</dt>
              <dd className="text-ink">{member.email || "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Jenis kelamin</dt>
              <dd className="text-ink capitalize">{member.gender || "-"}</dd>
            </div>
            <div className="flex justify-between gap-4"><dt className="text-ink-faint">RepUp Account</dt><dd>{member.repup_account_id ? <Badge tone="success">Connected</Badge> : <Badge>Belum Terhubung</Badge>}</dd></div>
          </dl>
          {member.notes && (
            <div id="notes" className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-ink-faint">Catatan</p>
              <p className="mt-1 text-sm text-ink">{member.notes}</p>
            </div>
          )}
          <div id="repup-account" className="mt-4 border-t border-line pt-4"><p className="mb-2 text-xs font-medium text-ink-faint">RepUp Account</p>{repupProfile ? <div className="space-y-1 text-sm"><p className="font-medium text-ink">{repupProfile.full_name}</p><p className="text-ink-muted">{repupProfile.phone || "-"}</p><p className="text-xs text-ink-faint">Connected sejak {formatDate(repupProfile.created_at)}</p></div> : <div><p className="mb-3 text-sm text-ink-muted">Belum terhubung ke akun RepUp.</p><PairingCodeButton memberId={member.id} /></div>}</div>
        </Card></div>

        <div className={tab === "overview" ? "space-y-6 lg:col-span-2" : "space-y-6 lg:col-span-3"}>
          <div hidden={tab !== "membership"}><Card id="membership" className="p-5">
            <SectionLabel>Riwayat Membership</SectionLabel>
            {!memberships || memberships.length === 0 ? (
              <EmptyState title="Belum ada membership" description="Member ini belum pernah membeli paket membership." />
            ) : (
              <div className="divide-y divide-line">
                {memberships.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{m.membership_plans?.name}</p>
                      <p className="text-xs text-ink-faint">
                        {formatDate(m.start_date)} – {m.end_date ? formatDate(m.end_date) : "Tanpa batas"}
                        {m.remaining_visits !== null ? ` · ${m.remaining_visits} kunjungan tersisa` : ""}
                      </p>
                    </div>
                    <MembershipStatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          </div>
          <div hidden={tab !== "overview"}><Card id="payments" className="p-5">
            <SectionLabel>Riwayat Transaksi</SectionLabel>
            {!transactions || transactions.length === 0 ? (
              <EmptyState title="Belum ada transaksi" />
            ) : (
              <div className="divide-y divide-line">
                {transactions.map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/transactions/${t.id}`}
                    className="flex items-center justify-between py-3 text-sm hover:text-primary"
                  >
                    <div>
                      <p className="num font-medium text-ink">{t.invoice_number}</p>
                      <p className="text-xs text-ink-faint">{formatDateTime(t.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="num font-medium">{formatCurrency(t.total)}</span>
                      <TransactionStatusBadge status={t.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          </div>
          <div hidden={tab !== "attendance"}><Card id="attendance" className="p-5">
            <SectionLabel>Riwayat Check-in</SectionLabel>
            {!checkins || checkins.length === 0 ? (
              <EmptyState title="Belum ada check-in" />
            ) : (
              <div className="divide-y divide-line">
                {checkins.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-ink-muted">{formatDateTime(c.occurred_at)}</span>
                    <MemberStatusBadge status={c.status === "success" ? "active" : "expired"} />
                  </div>
                ))}
              </div>
            )}
          </Card></div>
        </div>
      </div>)}
    </div>
  );
}
