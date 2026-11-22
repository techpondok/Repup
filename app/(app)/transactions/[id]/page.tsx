import { DataTable } from "@/components/ui/data-table";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, SectionLabel } from "@/components/ui/layout-bits";
import { TransactionStatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { TransactionMemberForm } from "@/components/pos/transaction-member-form";

const METHOD_LABEL: Record<string, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", other: "Lainnya" };

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getTenantContext();
  const supabase = await createClient();

  const { data: txn } = await supabase.from("transactions").select("*, members(full_name, member_code)").eq("id", id).eq("organization_id", ctx.organization.id).single();
  if (!txn) notFound();

  const { data: items } = await supabase.from("transaction_items").select("*").eq("transaction_id", id);
  const gym = ctx.gyms.find((g) => g.id === txn.gym_id);

  return (
    <div>
      <PageHeader
        title={txn.invoice_number}
        description={formatDateTime(txn.created_at)}
        actions={<TransactionStatusBadge status={txn.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionLabel>Item</SectionLabel>
          <DataTable className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="py-2 font-medium">Deskripsi</th>
                <th className="py-2 font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Harga</th>
                <th className="py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((it: any) => (
                <tr key={it.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 text-ink">{it.description}</td>
                  <td className="py-2.5 text-ink-muted">{it.quantity}</td>
                  <td className="num py-2.5 text-right text-ink-muted">{formatCurrency(it.unit_price, gym?.currency)}</td>
                  <td className="num py-2.5 text-right font-medium text-ink">{formatCurrency(it.total, gym?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>

          <div className="mt-4 ml-auto max-w-xs space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Subtotal</span>
              <span className="num">{formatCurrency(txn.subtotal, gym?.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Diskon</span>
              <span className="num">-{formatCurrency(txn.discount, gym?.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Pajak</span>
              <span className="num">{formatCurrency(txn.tax, gym?.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-ink">
              <span>Total</span>
              <span className="num">{formatCurrency(txn.total, gym?.currency)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Informasi</SectionLabel>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-faint">Customer</dt>
              <dd className="text-ink">{txn.members?.full_name ?? "Walk-in"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Metode Bayar</dt>
              <dd className="text-ink">{METHOD_LABEL[txn.payment_method]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-faint">Tipe</dt>
              <dd className="text-ink capitalize">{txn.transaction_type.replace("_", " ")}</dd>
            </div>
          </dl>
          {ctx.isOrgWide && !ctx.isDemo && txn.transaction_type === "sale" &&
            <TransactionMemberForm key={txn.member_id ?? "walk-in"} transactionId={txn.id}
              currentMemberCode={txn.members?.member_code ?? ""} currentMemberId={txn.member_id} />}
        </Card>
      </div>
    </div>
  );
}
