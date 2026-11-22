import { createStoreState, STORE_ORG_ID, type StoreOrder } from "./model";
import { purchaseAmounts, type Purchase } from "./purchase-history";
import { demoMembers } from "./demo-members";

export function createDemoStore() {
  const state = createStoreState();
  const member = demoMembers[0];
  const sales = [
    { method: "QRIS", lines: [{ id: "protein", quantity: 2 }, { id: "water", quantity: 1, name: "Air Mineral" }] },
    { method: "Cash", lines: [{ id: "towel", quantity: 1 }] },
    { method: "Bank Transfer", lines: [{ id: "snack", quantity: 2, price: 18000 }] },
  ] as const;
  const orders = sales.map(({ method, lines }, index): StoreOrder => {
    const items = lines.map(line => {
      const product = state.products.find(product => product.id === line.id)!;
      return {
        productId: product.id,
        name: "name" in line ? line.name : product.name,
        sku: product.sku,
        quantity: line.quantity,
        price: "price" in line ? line.price : product.price,
      };
    });
    const id = `TRX-2026-00${index + 1}`;
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const date = Date.UTC(2026, 10, 10 + index, 3);
    return {
      id, organizationId: STORE_ORG_ID, branchId: member.branchId, memberId: member.id, customerName: member.full_name,
      source: "cashier", lines: items, subtotal: total, discount: 0, tax: 0, total, paymentStatus: "paid",
      fulfillmentStatus: "picked_up", paymentMethod: method, createdAt: date, expiresAt: null, paidAt: date,
      pickedUpAt: date, pickupToken: `store-demo:00000000-0000-4000-8000-00000000000${index + 1}`,
      requestId: id, cashierName: "Yudha Demo",
    };
  });
  return { ...state, orders };
}

export function demoPurchase(order: StoreOrder): Purchase {
  return {
    ...purchaseAmounts(order.total, order.subtotal, order.subtotal, order.refundedAmount ?? 0, order.paymentStatus === "refunded"),
    id: order.id, date: new Date(order.paidAt ?? order.createdAt).toISOString(), cashier: order.cashierName ?? null,
    method: order.paymentMethod === "Bank Transfer" ? "Transfer" : order.paymentMethod ?? "—",
    items: order.lines.map(item => ({ id: item.productId, name: item.name, sku: item.sku, quantity: item.quantity, price: item.price, subtotal: item.quantity * item.price, physical: true })),
    subtotal: order.subtotal, discount: order.discount, tax: order.tax, total: order.total,
    amountPaid: order.total, change: order.paymentMethod === "Cash" ? 0 : null, receipt: `/pos/orders/${order.id}`,
  };
}
