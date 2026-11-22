import { DataTable } from "@/components/ui/data-table";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, SectionLabel } from "@/components/ui/layout-bits";
import { LinkButton } from "@/components/ui/button";
import { Badge, MembershipStatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus } from "lucide-react";
import { MembershipActions } from "@/components/memberships/membership-actions";
import { packages } from "@/lib/demo/member-management";

const UNIT_LABEL: Record<string, string> = { day: "hari", month: "bulan", year: "tahun", visit: "kunjungan" };
const ACCESS_LABEL: Record<string, string> = { single: "1 Cabang", selected: "Cabang Terpilih", all: "Semua Cabang" };

export default async function MembershipsPage() {
  const ctx = await getTenantContext();
  if (ctx.isDemo) {
    return (
      <div>
        <PageHeader title="Membership" description="Contoh paket membership gym." />
        <SectionLabel>Paket Membership</SectionLabel>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((plan) => (
            <Card key={plan.id} className="p-5">
              <p className="font-medium text-ink">{plan.name}</p>
              <p className="num mt-2 text-xl font-semibold text-ink">{formatCurrency(plan.price)}</p>
              <p className="mt-1 text-xs text-ink-faint">{plan.days} hari</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .is("archived_at", null)
    .order("price");

  let membershipsQuery = supabase
    .from("memberships")
    .select("*, members(full_name, member_code), membership_plans(name)")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (ctx.branch) membershipsQuery = membershipsQuery.eq("branch_id", ctx.branch.id);
  const { data: activeMemberships } = await membershipsQuery;

  return (
    <div>
      <PageHeader
        title="Membership"
        description="Kelola paket membership dan status keanggotaan member."
        actions={
          <LinkButton href="/memberships/new">
            <Plus size={16} /> Buat Paket
          </LinkButton>
        }
      />

      <SectionLabel>Paket Membership</SectionLabel>
      {!plans || plans.length === 0 ? (
        <EmptyState
          title="Belum ada paket membership"
          description="Buat paket seperti Monthly, 3 Bulan, Annual, atau Day Pass."
          action={
            <LinkButton href="/memberships/new">
              <Plus size={16} /> Buat Paket
            </LinkButton>
          }
        />
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p: any) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between">
                <p className="font-medium text-ink">{p.name}</p>
                <Badge tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Aktif" : "Nonaktif"}</Badge>
              </div>
              <p className="num mt-2 text-xl font-semibold text-ink">{formatCurrency(p.price)}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {p.duration_value} {UNIT_LABEL[p.duration_unit]}
                {p.visit_limit ? ` · ${p.visit_limit} kunjungan` : ""} · {ACCESS_LABEL[p.branch_access]}
              </p>
              {p.description && <p className="mt-2 text-sm text-ink-muted">{p.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <SectionLabel>Keanggotaan Aktif</SectionLabel>
      <Card>
        {!activeMemberships || activeMemberships.length === 0 ? (
          <EmptyState title="Belum ada keanggotaan" description="Keanggotaan akan muncul setelah member membeli paket melalui Kasir." />
        ) : (
          <DataTable className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Paket</th>
                <th className="px-4 py-3 font-medium">Berlaku</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {activeMemberships.map((m: any) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{m.members?.full_name}</p>
                    <p className="num text-xs text-ink-faint">{m.members?.member_code}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{m.membership_plans?.name}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(m.start_date)} – {m.end_date ? formatDate(m.end_date) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <MembershipStatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <MembershipActions membershipId={m.id} organizationId={ctx.organization.id} status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
