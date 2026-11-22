"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { loadPurchaseHistory } from "@/app/actions/purchase-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/field";
import { Card, EmptyState, Stat, SectionLabel } from "@/components/ui/layout-bits";
import { useStore } from "@/components/store/store-provider";
import { demoPurchase } from "@/lib/store/demo-purchases";
import { purchaseStatuses, summarizePurchases, type Purchase } from "@/lib/store/purchase-history";
import { formatCurrency } from "@/lib/format";

const pageSize = 10;
const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
const dateTime = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" });

function Status({ purchase }: { purchase: Purchase }) {
  return <Badge tone={purchase.status === "Completed" ? "success" : purchase.status === "Refunded" ? "neutral" : "warning"}>{purchase.status}</Badge>;
}

function ReceiptDrawer({ purchase, onClose, onPrint }: { purchase: Purchase; onClose: () => void; onPrint?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const fields = [
    ["Transaction ID", purchase.id],
    ["Transaction Date", dateTime.format(new Date(purchase.date))],
    ["Cashier Name", purchase.cashier ?? "—"],
    ["Payment Method", purchase.method],
  ];
  const totals: [string, string][] = [
    ["Subtotal", formatCurrency(purchase.subtotal)], ["Discount", formatCurrency(purchase.discount)],
    ...(purchase.tax ? [["Tax", formatCurrency(purchase.tax)] as [string, string]] : []),
    ["Grand Total", formatCurrency(purchase.total)], ["Amount Paid", formatCurrency(purchase.amountPaid)],
    ...(purchase.method === "Cash" ? [["Change", purchase.change == null ? "Unavailable" : formatCurrency(purchase.change)] as [string, string]] : []),
    ...(purchase.refunded ? [["Refunded", formatCurrency(purchase.refunded)] as [string, string]] : []),
  ];

  return <dialog ref={dialog} onClose={onClose} onClick={event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }} aria-labelledby="purchase-receipt-title" className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-xl overflow-y-auto border-l border-line bg-surface text-ink shadow-xl backdrop:bg-black/55">
    <div className="min-h-full space-y-6 p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <h2 id="purchase-receipt-title" className="text-lg font-semibold">Transaction Detail</h2>
        <Button variant="ghost" size="sm" aria-label="Close transaction detail" onClick={() => dialog.current?.close()}><X size={18} /></Button>
      </header>
      <section>
        <SectionLabel>Transaction Information</SectionLabel>
        <dl className="space-y-2 text-sm">
          {fields.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-ink-muted">{label}</dt><dd className="break-words text-right">{value}</dd></div>)}
          <div className="flex justify-between gap-4"><dt className="text-ink-muted">Transaction Status</dt><dd><Status purchase={purchase} /></dd></div>
        </dl>
      </section>
      <section>
        <SectionLabel>Purchased Items</SectionLabel>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {purchase.items.map(item => <li key={item.id} className="p-3 text-sm">
            <div className="flex justify-between gap-3"><p className="font-medium">{item.name}</p><span className="num shrink-0">{formatCurrency(item.subtotal)}</span></div>
            <div className="text-xs text-ink-muted">SKU {item.sku ?? "—"} · {item.quantity} × {formatCurrency(item.price)} · Item discount {formatCurrency(0)}</div>
          </li>)}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">Discount is applied to the transaction total.</p>
      </section>
      <section>
        <SectionLabel>Payment Summary</SectionLabel>
        <dl className="space-y-2 text-sm">{totals.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-ink-muted">{label}</dt><dd className="num">{value}</dd></div>)}</dl>
      </section>
      {purchase.receipt && <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button variant="secondary" onClick={onPrint}>Print Receipt (demo)</Button>
        <Link className="text-sm font-medium text-primary" href={purchase.receipt}>Open POS receipt</Link>
      </div>}
    </div>
  </dialog>;
}

function History({ purchases, onPrint }: { purchases: Purchase[]; onPrint?: (purchase: Purchase) => void }) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [printed, setPrinted] = useState(false);
  const summary = summarizePurchases(purchases);
  const filtered = purchases.filter(purchase => {
    const date = dateKey.format(new Date(purchase.date));
    return purchase.id.toLowerCase().includes(query.trim().toLowerCase()) && (!status || purchase.status === status)
      && (!from || date >= from) && (!to || date <= to);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);
  const itemsLabel = (purchase: Purchase) => purchase.items.filter(item => item.physical).map(item => `${item.name} ×${item.quantity}`).join(", ");
  const action = (purchase: Purchase) => <Button variant="secondary" size="sm" onClick={() => { setPrinted(false); setSelected(purchase); }}>View Detail</Button>;

  return <section aria-label="Purchase History" className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><Stat label="Total Spent" value={formatCurrency(summary.total)} /></Card>
      <Card><Stat label="Total Transactions" value={String(summary.count)} /></Card>
      <Card><Stat label="Last Purchase" value={summary.last ? dateOnly.format(new Date(summary.last)) : "—"} /></Card>
    </div>
    {!purchases.length ? <Card><EmptyState title="No purchases yet. This member's purchase history will appear here." /></Card> : <>
      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">Transaction ID<Input className="mt-1" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search transaction ID" /></label>
        <label className="text-sm">From<Input className="mt-1" type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label>
        <label className="text-sm">To<Input className="mt-1" type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} /></label>
        <label className="text-sm">Payment status<Select className="mt-1" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{purchaseStatuses.map(value => <option key={value}>{value}</option>)}</Select></label>
      </Card>
      <Card>
        {!rows.length ? <EmptyState title="No matching purchases" description="Try changing the search or filters." /> : <>
          <div className="hidden overflow-x-auto md:block">
            <DataTable className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-ink-muted">{["Transaction ID", "Date & Time", "Items", "Total", "Payment Method", "Status", "Action"].map(title => <th key={title} scope="col" className="px-4 py-3 font-medium">{title}</th>)}</tr></thead>
              <tbody>{rows.map(purchase => <tr key={purchase.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">{purchase.id}</th>
                <td className="px-4 py-3">{dateTime.format(new Date(purchase.date))}</td>
                <td className="px-4 py-3">{itemsLabel(purchase)}</td>
                <td className="num whitespace-nowrap px-4 py-3">{formatCurrency(purchase.total)}</td>
                <td className="px-4 py-3">{purchase.method}</td>
                <td className="px-4 py-3"><Status purchase={purchase} /></td>
                <td className="px-4 py-3">{action(purchase)}</td>
              </tr>)}</tbody>
            </DataTable>
          </div>
          <ul className="divide-y divide-line md:hidden">{rows.map(purchase => <li key={purchase.id} className="space-y-2 p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>{purchase.id}</strong><Status purchase={purchase} /></div>
            <p className="text-xs text-ink-muted">{dateTime.format(new Date(purchase.date))} · {purchase.method}</p>
            <p>{itemsLabel(purchase)}</p>
            <div className="flex items-center justify-between gap-2"><strong className="num">{formatCurrency(purchase.total)}</strong>{action(purchase)}</div>
          </li>)}</ul>
        </>}
        {pages > 1 && <nav aria-label="Purchase history pages" className="flex flex-wrap items-center justify-end gap-3 border-t border-line p-3 text-sm">
          <Button variant="secondary" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
          <span>Page {current} of {pages}</span>
          <Button variant="secondary" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</Button>
        </nav>}
      </Card>
    </>}
    {printed && <p role="status" className="text-sm text-ink-muted">Receipt print simulated.</p>}
    {selected && <ReceiptDrawer purchase={selected} onClose={() => setSelected(null)} onPrint={onPrint ? () => { onPrint(selected); setSelected(null); setPrinted(true); } : undefined} />}
  </section>;
}

export function LivePurchaseHistory({ memberId }: { memberId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadPurchaseHistory>> | null>(null);
  useEffect(() => {
    let active = true;
    loadPurchaseHistory(memberId).then(
      value => { if (active) setResult(value); },
      () => { if (active) setResult({ purchases: [], error: "Could not load purchase history." }); },
    );
    return () => { active = false; };
  }, [memberId, attempt]);

  if (!result) return <Card className="p-5"><p role="status" className="text-sm text-ink-muted">Loading purchase history…</p></Card>;
  if (result.error) return <Card className="space-y-3 p-5"><p role="alert" className="text-sm text-danger">{result.error}</p><Button variant="secondary" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Retry</Button></Card>;
  return <History purchases={result.purchases} />;
}

export function DemoPurchaseHistory({ memberId, branchIds }: { memberId: string; branchIds: string[] }) {
  const { state, notify } = useStore();
  return <History purchases={state.orders.filter(order => order.memberId === memberId && branchIds.includes(order.branchId)
    && (order.paymentStatus === "paid" || order.paymentStatus === "refunded")).map(demoPurchase)}
    onPrint={() => notify("Receipt print simulated.")} />;
}
