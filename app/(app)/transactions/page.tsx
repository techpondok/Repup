import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { TransactionStatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = { cash: "Tunai", transfer: "Transfer", qris: "QRIS", other: "Lainnya" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; method?: string }>;
}) {
  const ctx = await getTenantContext();
  if (ctx.isDemo) {
    return (
      <div>
        <PageHeader title="Transaksi" description="Riwayat transaksi per cabang." />
        <Card>
          <EmptyState title="Data tersedia di akun gym" />
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("*, members(full_name)")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (ctx.branch) query = query.eq("branch_id", ctx.branch.id);
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.method) query = query.eq("payment_method", sp.method);

  const { data: transactions } = await query;

  const gym = ctx.gyms.find((g) => g.id === ctx.branch?.gym_id);

  return (
    <div>
      <PageHeader title="Transaksi" description={`Riwayat transaksi di ${ctx.branch?.name ?? ctx.organization.name}`} />

      <Card>
        {!transactions || transactions.length === 0 ? (
          <EmptyState title="Belum ada transaksi" description="Transaksi akan muncul di sini setelah kasir memproses penjualan." />
        ) : (
          <DataTable className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Metode</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any) => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/transactions/${t.id}`} className="num font-medium text-ink hover:text-primary">
                      {t.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{t.members?.full_name ?? "Walk-in"}</td>
                  <td className="px-4 py-3 text-ink-muted">{METHOD_LABEL[t.payment_method]}</td>
                  <td className="num px-4 py-3 font-medium text-ink">{formatCurrency(t.total, gym?.currency)}</td>
                  <td className="px-4 py-3">
                    <TransactionStatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDateTime(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
