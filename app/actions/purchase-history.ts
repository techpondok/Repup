"use server";

import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { purchaseAmounts, type Purchase } from "@/lib/store/purchase-history";

export async function loadPurchaseHistory(memberId: string): Promise<{ purchases: Purchase[]; error?: string }> {
  const ctx = await getTenantContext();
  if (ctx.isDemo || !/^[\da-f-]{36}$/i.test(memberId)) return { purchases: [], error: "Purchase history is unavailable." };
  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase.from("members").select("id")
    .eq("id", memberId).eq("organization_id", ctx.organization.id).maybeSingle();
  if (memberError || !member) return { purchases: [], error: "Purchase history is unavailable." };

  const purchases: Purchase[] = [];
  const batchSize = 100;
  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase.from("transactions")
      .select("id,invoice_number,created_at,payment_method,status,subtotal,discount,tax,total,cash_tendered,profiles!transactions_cashier_id_fkey(full_name),physical:transaction_items!inner(id),items:transaction_items(id,description,product_sku,is_physical_product,quantity,unit_price,total),payments(amount,status,paid_at)")
      .eq("organization_id", ctx.organization.id).eq("member_id", memberId)
      .eq("payments.organization_id", ctx.organization.id)
      .eq("physical.is_physical_product", true).in("status", ["paid", "refunded"])
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + batchSize - 1);
    if (error) {
      console.error("[POS][PURCHASE_HISTORY]", error.code);
      return { purchases: [], error: "Could not load purchase history." };
    }
    for (const row of data) {
      const items = row.items.map((item: { id: string; description: string; product_sku: string | null; is_physical_product: boolean; quantity: number; unit_price: number; total: number }) => ({
        id: item.id, name: item.description, sku: item.product_sku, physical: item.is_physical_product,
        quantity: item.quantity, price: Number(item.unit_price), subtotal: Number(item.total),
      }));
      const physicalSubtotal = items.reduce((sum, item) => sum + (item.physical ? item.subtotal : 0), 0);
      const payments: { amount: number; status: string; paid_at: string }[] = row.payments;
      const refund = payments.filter(payment => payment.status === "refunded").reduce((sum, payment) => sum + Math.abs(Number(payment.amount)), 0);
      const paid = payments.filter(payment => payment.status === "paid");
      const method = ({ cash: "Cash", transfer: "Transfer", qris: "QRIS", other: "Other" } as Record<string, string>)[row.payment_method];
      const date = paid.map(payment => payment.paid_at).sort().at(-1) ?? row.created_at;
      const profile = row.profiles as unknown as { full_name: string } | null;
      purchases.push({
        ...purchaseAmounts(Number(row.total), Number(row.subtotal), physicalSubtotal, refund, row.status === "refunded"),
        id: row.invoice_number, date: new Date(date).toISOString(), cashier: profile?.full_name ?? null,
        method, items, subtotal: Number(row.subtotal), discount: Number(row.discount), tax: Number(row.tax),
        total: Number(row.total), amountPaid: row.cash_tendered == null ? (paid.length ? paid.reduce((sum, payment) => sum + Number(payment.amount), 0) : Number(row.total)) : Number(row.cash_tendered),
        change: row.cash_tendered == null ? null : Number(row.cash_tendered) - Number(row.total),
      });
    }
    if (data.length < batchSize) return { purchases };
  }
}
