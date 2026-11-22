export const purchaseStatuses = ["Completed", "Refunded", "Partially Refunded"] as const;
export type PurchaseStatus = typeof purchaseStatuses[number];

export interface Purchase {
  id: string;
  date: string;
  cashier: string | null;
  method: string;
  status: PurchaseStatus;
  items: { id: string; name: string; sku: string | null; quantity: number; price: number; subtotal: number; physical: boolean }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  refunded: number;
  change: number | null;
  physicalNet: number;
  receipt?: string;
}

export function purchaseAmounts(total: number, subtotal: number, physicalSubtotal: number, refunded: number, fullyRefunded: boolean) {
  const refund = fullyRefunded ? total : Math.min(total, Math.max(0, refunded));
  const ratio = subtotal > 0 ? Math.min(1, physicalSubtotal / subtotal) : 0;
  return {
    refunded: refund,
    status: (fullyRefunded || (refund > 0 && refund >= total) ? "Refunded" : refund > 0 ? "Partially Refunded" : "Completed") as PurchaseStatus,
    physicalNet: Math.round((total - refund) * ratio * 100) / 100,
  };
}

export function summarizePurchases(purchases: Purchase[]) {
  let total = 0;
  let count = 0;
  let last: string | null = null;
  for (const purchase of purchases) {
    total += Math.round(purchase.physicalNet * 100);
    if (!last || purchase.date > last) last = purchase.date;
    if (purchase.status !== "Refunded") count++;
  }
  return { total: total / 100, count, last };
}
