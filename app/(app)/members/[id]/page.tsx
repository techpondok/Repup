import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, SectionLabel, EmptyState } from "@/components/ui/layout-bits";
import { MemberStatusBadge, MembershipStatusBadge, TransactionStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ShoppingCart } from "lucide-react";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const supabase = await createClient();

  const { data: member } = await supabase.from("members").select("*").eq("id", id).single();
  if (!member) notFound();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("*, membership_plans(name)")
    .eq("member_id", id)
    .order("created_at", { ascending: false });

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("member_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: checkins } = await supabase
    .from("check_ins")
    .select("*")
    .eq("member_id", id)
    .order("occurred_at", { ascending: false })
    .limit(10);

  const branch = ctx.branches.find((b) => b.id === member.branch_id);

  return (
    <div>
      <PageHeader
        title={member.full_name}
        description={`${member.member_code} · Bergabung ${formatDate(member.join_date)} · ${branch?.name ?? ""}`}
        actions={
          <LinkButton href={`/pos?member=${member.id}`}>
            <ShoppingCart size={16} /> Buat Transaksi
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <SectionLabel>Profil</SectionLabel>
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
          </dl>
          {member.notes && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-xs text-ink-faint">Catatan</p>
              <p className="mt-1 text-sm text-ink">{member.notes}</p>
            </div>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
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

          <Card className="p-5">
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

          <Card className="p-5">
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
          </Card>
        </div>
      </div>
    </div>
  );
}
