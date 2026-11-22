"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Minus, PackageCheck, Plus, Printer, Search, ShoppingBasket, Trash2 } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useStore } from "@/components/store/store-provider";
import { useStoreActor, useStoreBranches } from "@/components/store/store-scope";
import { useMemberDemo } from "@/components/members/demo-provider";
import { STORE_BRANCHES, STORE_CATEGORIES, availableStock, canDiscount, storeMoney, visibleOrders, visibleProducts, type StoreOrder, type PaymentMethod } from "@/lib/store/model";

const paymentMethods: PaymentMethod[] = ["Cash", "QRIS", "Bank Transfer", "Other"];
const paymentStatuses = ["unpaid", "pending", "paid", "failed", "refunded"];
const fulfillmentStatuses = ["awaiting_payment", "preparing", "ready_for_pickup", "picked_up", "cancelled"];
const branchName = (id: string) => STORE_BRANCHES.find(branch => branch.id === id)?.name || id;
const readable = (value: string) => value.replaceAll("_", " ");
const orderDate = (value: number) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(value);

function StoreTabs({ active }: { active: "pos" | "orders" | "pickup" }) {
  return <nav className="mb-6 flex flex-wrap gap-2" aria-label="Cashier store pages">{[{ key: "pos", href: "/pos", title: "Point of sale" }, { key: "orders", href: "/pos/orders", title: "Transactions" }, { key: "pickup", href: "/pos/pickup", title: "Pickup scanner" }].map(item => <Link key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-lg border px-4 py-2 text-sm ${active === item.key ? "border-primary bg-primary-tint font-medium text-primary" : "border-line bg-surface text-ink-muted hover:text-ink"}`}>{item.title}</Link>)}</nav>;
}

function OrderStatuses({ order }: { order: StoreOrder }) {
  return <div className="flex flex-wrap gap-2"><Badge tone={order.paymentStatus === "paid" ? "success" : order.paymentStatus === "failed" ? "danger" : "warning"}>{readable(order.paymentStatus)}</Badge><Badge tone={order.fulfillmentStatus === "picked_up" ? "success" : order.fulfillmentStatus === "cancelled" ? "neutral" : "info"}>{readable(order.fulfillmentStatus)}</Badge></div>;
}

function StoreError({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-danger bg-surface p-3 text-sm text-danger">{message}</p> : null;
}

export function CashierStore({ initialMemberId }: { initialMemberId?: string }) {
  const actor = useStoreActor();
  const { state, now, dispatch, cashierCart, setCashierCart, notify } = useStore();
  const router = useRouter();
  const { members } = useMemberDemo();
  const branches = useStoreBranches();
  const [branchId, setBranchId] = useState(() => branches.find(branch => members.some(member => member.id === initialMemberId && member.branchId === branch.id))?.id ?? branches[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [customer, setCustomer] = useState(initialMemberId ?? "");
  const [memberSearch, setMemberSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const request = useRef<{ key: string; id: string; pickupToken: string } | null>(null);
  const selectedMember = members.find(member => member.id === customer && member.branchId === branchId);
  const matchingMembers = members.filter(member => member.branchId === branchId && (member.id === customer || `${member.name} ${member.id} ${member.phone}`.toLowerCase().includes(memberSearch.trim().toLowerCase())));
  const products = visibleProducts(state, actor, "cashier");
  const filtered = products.filter(product => (category === "all" || product.category === category) && `${product.name} ${product.sku} ${product.barcode}`.toLowerCase().includes(search.trim().toLowerCase()));
  const cart = cashierCart.map(line => ({ ...line, product: products.find(product => product.id === line.productId) }));
  const subtotal = cart.reduce((total, line) => total + (line.product?.price || 0) * line.quantity, 0);
  const discountValue = canDiscount(actor) ? Number(discount) : 0;
  const validDiscount = Number.isSafeInteger(discountValue) && discountValue >= 0 && discountValue <= subtotal;
  const tax = Math.round(Math.max(0, subtotal - (validDiscount ? discountValue : 0)) * state.taxRate);
  const total = subtotal - (validDiscount ? discountValue : 0) + tax;
  const invalidCart = !cashierCart.length || cart.some(line => !line.product || line.quantity < 1 || line.quantity > availableStock(state, line.productId, branchId, now));

  function changeQuantity(productId: string, quantity: number) {
    setError("");
    if (quantity > 999) { setError("A cart line can contain at most 999 items."); return; }
    if (quantity > availableStock(state, productId, branchId, now)) { setError("Available stock is insufficient for this quantity."); return; }
    setCashierCart(previous => quantity <= 0 ? previous.filter(line => line.productId !== productId) : previous.some(line => line.productId === productId) ? previous.map(line => line.productId === productId ? { ...line, quantity } : line) : [...previous, { productId, quantity }]);
  }

  function completeSale() {
    if (submitting || invalidCart || !validDiscount || !branchId) return;
    const name = selectedMember?.name ?? (customerName.trim() || "Walk-in customer");
    const key = JSON.stringify({ branchId, cashierCart, customer, name, discountValue, paymentMethod });
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID(), pickupToken: `store-demo:${crypto.randomUUID()}` };
    setSubmitting(true);
    const result = dispatch({ type: "create-order", actor, source: "cashier", branchId, lines: cashierCart, customerName: name, memberId: selectedMember?.id ?? null, discount: discountValue, paymentMethod, requestId: request.current.id, pickupToken: request.current.pickupToken });
    setSubmitting(false);
    setConfirm(false);
    if (result.error) { setError(result.error); return; }
    if (!result.orderId) { setError("The transaction could not be located. Check Transactions before retrying."); return; }
    setCashierCart([]);
    notify("Mock sale completed. Payment and goods handover recorded locally.");
    router.push(`/pos/orders/${result.orderId}`);
  }

  return <div><PageHeader title="Point of sale" description="Gym products, quick checkout, and member pickup orders."/><StoreTabs active="pos"/>
    {!branches.length ? <EmptyState title="No permitted branch" description="Your current role has no branch access."/> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
      <section className="min-w-0 space-y-4"><Card className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-ink">Selling branch<Select className="mt-2" value={branchId} onChange={event => { setBranchId(event.target.value); setCustomer(""); setMemberSearch(""); setCashierCart([]); setError(""); notify("Branch changed. Cashier cart cleared."); }}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label><label className="text-sm text-ink">Category<Select className="mt-2" value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{STORE_CATEGORIES.map(value => <option key={value}>{value}</option>)}</Select></label></div><label className="block text-sm text-ink">Search products<div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-3 text-ink-muted" size={16}/><Input className="pl-10" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Product name, SKU, or barcode"/></div></label></Card>
        {filtered.length ? <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{filtered.map(product => { const stock = availableStock(state, product.id, branchId, now); const inCart = cashierCart.find(line => line.productId === product.id)?.quantity || 0; return <Card key={product.id} className="flex min-w-0 flex-col overflow-hidden"><Image src={product.images[0] || "/store/water.svg"} alt={product.name} width={400} height={300} unoptimized className="aspect-[4/3] w-full bg-canvas object-cover"/><div className="flex flex-1 flex-col gap-3 p-4"><span className="text-xs text-ink-muted">{product.category}</span><h2 className="text-sm font-semibold text-ink">{product.name}</h2><p className="break-all text-xs text-ink-muted">{product.sku}</p><p className="text-sm font-semibold text-ink">{storeMoney(product.price)}</p><span className={`text-xs ${stock ? "text-ink-muted" : "text-danger"}`}>{stock ? `${stock} available` : "Out of stock"}</span><Button className="mt-auto w-full whitespace-normal" variant="secondary" disabled={stock <= inCart} onClick={() => changeQuantity(product.id, inCart + 1)}><Plus size={15}/>Add{inCart ? ` (${inCart})` : ""}</Button></div></Card>; })}</div> : <EmptyState title="No matching products" description="Try another product name, SKU, barcode, or category." action={<Button variant="secondary" onClick={() => { setSearch(""); setCategory("all"); }}>Reset filters</Button>}/>}</section>
      <Card className="min-w-0 space-y-5 p-5"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold text-ink"><ShoppingBasket size={19}/>Current sale</h2><span className="text-xs text-ink-muted">{cashierCart.reduce((sum, line) => sum + line.quantity, 0)} items</span></div>
        {!cart.length ? <p className="rounded-lg border border-dashed border-line p-5 text-sm text-ink-muted">Select products to begin a sale.</p> : <ul className="divide-y divide-line">{cart.map(line => <li key={line.productId} className="space-y-3 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium text-ink">{line.product?.name || "Product no longer available"}</p><p className="mt-1 text-xs text-ink-muted">{storeMoney(line.product?.price || 0)} each</p></div><Button variant="ghost" size="sm" aria-label={`Remove ${line.product?.name || "product"}`} onClick={() => changeQuantity(line.productId, 0)}><Trash2 size={16}/></Button></div><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Button variant="secondary" size="sm" aria-label={`Decrease ${line.product?.name || "product"}`} onClick={() => changeQuantity(line.productId, line.quantity - 1)}><Minus size={14}/></Button><span className="min-w-6 text-center text-sm text-ink">{line.quantity}</span><Button variant="secondary" size="sm" aria-label={`Increase ${line.product?.name || "product"}`} disabled={line.quantity >= availableStock(state, line.productId, branchId, now)} onClick={() => changeQuantity(line.productId, line.quantity + 1)}><Plus size={14}/></Button></div><strong className="text-sm text-ink">{storeMoney((line.product?.price || 0) * line.quantity)}</strong></div></li>)}</ul>}
        {!!cashierCart.length && invalidCart && <p role="alert" className="text-sm text-danger">Some cart items are unavailable or exceed stock at this branch. Remove items or lower their quantity.</p>}
        <label className="block text-sm text-ink">Find member<Input type="search" className="mt-2" placeholder="Name, member number, or phone" value={memberSearch} onChange={event => setMemberSearch(event.target.value)}/></label><label className="block text-sm text-ink">Select Customer / Member<Select className="mt-2" value={selectedMember?.id ?? ""} onChange={event => setCustomer(event.target.value)}><option value="">Walk-in Customer</option>{matchingMembers.map(member => <option key={member.id} value={member.id}>{member.name} · {member.id}</option>)}</Select></label>{!selectedMember && <label className="block text-sm text-ink">Customer name (optional)<Input className="mt-2" maxLength={80} value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Walk-in customer"/></label>}
        {canDiscount(actor) && <label className="block text-sm text-ink">Discount (IDR)<Input className="mt-2" type="number" min="0" max={subtotal} step="1" value={discount} onChange={event => setDiscount(event.target.value)}/></label>}
        <label className="block text-sm text-ink">Payment method<Select className="mt-2" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</Select></label>
        <dl className="space-y-3 border-t border-line pt-4 text-sm text-ink"><div className="flex justify-between gap-3"><dt className="text-ink-muted">Subtotal</dt><dd>{storeMoney(subtotal)}</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-muted">Discount</dt><dd>-{storeMoney(validDiscount ? discountValue : 0)}</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-muted">Tax ({state.taxRate * 100}%)</dt><dd>{storeMoney(tax)}</dd></div><div className="flex justify-between gap-3 border-t border-line pt-3 font-semibold"><dt>Total</dt><dd>{storeMoney(total)}</dd></div></dl>
        {!validDiscount && <p role="alert" className="text-sm text-danger">Discount must be between zero and the subtotal.</p>}<StoreError message={error}/><Button className="w-full whitespace-normal" disabled={invalidCart || !validDiscount || submitting} onClick={() => { setError(""); setConfirm(true); }}>Review payment &amp; handover</Button><p className="text-xs leading-relaxed text-ink-muted">Mock checkout only. Confirm after goods are handed over. This records payment and pickup together, without charging real money.</p></Card>
    </div>}
    <ConfirmDialog open={confirm} title="Complete this mock sale?" description={`${storeMoney(total)} via ${paymentMethod}. Confirm simulated payment and immediate goods handover at ${branchName(branchId)}.`} confirmLabel="Complete sale" pending={submitting} onClose={() => setConfirm(false)} onConfirm={completeSale}/>
  </div>;
}

export function CashierOrders() {
  const branches = useStoreBranches();
  const actor = useStoreActor(); const { state } = useStore();
  const [search, setSearch] = useState(""); const [branch, setBranch] = useState("all"); const [payment, setPayment] = useState("all"); const [fulfillment, setFulfillment] = useState("all"); const [limit, setLimit] = useState(20);
  const orders = visibleOrders(state, actor).filter(order => (branch === "all" || order.branchId === branch) && (payment === "all" || order.paymentStatus === payment) && (fulfillment === "all" || order.fulfillmentStatus === fulfillment) && `${order.id} ${order.customerName} ${order.lines.map(line => line.name).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => b.createdAt - a.createdAt);
  return <div><PageHeader title="Store transactions" description="Cashier sales and member orders within your permitted branches."/><StoreTabs active="orders"/><Card className="mb-5 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm text-ink">Order or customer<Input className="mt-2" type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(20); }} placeholder="Order ID, name, product"/></label><label className="text-sm text-ink">Branch<Select className="mt-2" value={branch} onChange={event => setBranch(event.target.value)}><option value="all">All permitted branches</option>{branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label><label className="text-sm text-ink">Payment<Select className="mt-2 capitalize" value={payment} onChange={event => setPayment(event.target.value)}><option value="all">All payment statuses</option>{paymentStatuses.map(value => <option key={value}>{value}</option>)}</Select></label><label className="text-sm text-ink">Fulfillment<Select className="mt-2 capitalize" value={fulfillment} onChange={event => setFulfillment(event.target.value)}><option value="all">All fulfillment statuses</option>{fulfillmentStatuses.map(value => <option key={value} value={value}>{readable(value)}</option>)}</Select></label></Card>
    {orders.length ? <div className="space-y-3">{orders.slice(0, limit).map(order => <Card key={order.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><Link href={`/pos/orders/${order.id}`} className="break-all text-sm font-semibold text-ink hover:text-primary">{order.id}</Link><p className="mt-1 text-sm text-ink-muted">{order.customerName} | {branchName(order.branchId)}</p><p className="mt-2 text-xs text-ink-muted">{orderDate(order.createdAt)} WIB | {order.source === "member" ? "Member order" : "Cashier sale"}</p></div><div className="space-y-2"><p className="text-sm font-semibold text-ink">{storeMoney(order.total)}</p><OrderStatuses order={order}/></div></div><Link href={`/pos/orders/${order.id}`} className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-primary">View receipt &amp; process order</Link></Card>)}{orders.length > limit && <Button variant="secondary" onClick={() => setLimit(value => value + 20)}>Load more transactions</Button>}</div> : <EmptyState title="No transactions found" description="Complete a cashier sale, or adjust the filters to see member orders." action={<LinkButton href="/pos">Open point of sale</LinkButton>}/>}</div>;
}

export function CashierOrderDetail({ id }: { id: string }) {
  const actor = useStoreActor(); const { state, dispatch, notify } = useStore();
  const order = visibleOrders(state, actor).find(item => item.id === id);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [confirm, setConfirm] = useState<"pay-order" | "ready-order" | "cancel-order" | null>(null); const [error, setError] = useState("");
  if (!order) return <><StoreTabs active="orders"/><EmptyState title="Order not found" description="The preview may have reset, or this order is outside your permitted branches." action={<LinkButton href="/pos/orders">Back to transactions</LinkButton>}/></>;
  function processOrder() {
    if (!order || !confirm) return;
    const result = dispatch(confirm === "pay-order" ? { type: "pay-order", actor, orderId: order.id, paymentMethod } : confirm === "ready-order" ? { type: "ready-order", actor, orderId: order.id } : { type: "cancel-order", actor, orderId: order.id });
    setConfirm(null);
    if (result.error) { setError(result.error); return; }
    setError(""); notify(confirm === "pay-order" ? "Mock payment recorded. Order is ready for preparation." : confirm === "ready-order" ? "Order marked ready for pickup." : "Mock order cancelled. Reserved stock or simulated payment was released.");
  }
  const canPay = !["paid", "refunded"].includes(order.paymentStatus) && order.fulfillmentStatus !== "cancelled";
  return <div><PageHeader title={`Receipt ${order.id}`} description="Transaction snapshot. All payments and handovers on this screen are simulated." actions={<Button variant="secondary" onClick={() => notify("Receipt print simulated. No printer or external service was contacted.")}><Printer size={16}/>Simulate print</Button>}/><StoreTabs active="orders"/>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]"><Card className="space-y-6 p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="font-semibold text-ink">RepUp Gym Store</p><p className="mt-1 text-sm text-ink-muted">{branchName(order.branchId)}</p></div><OrderStatuses order={order}/></div><dl className="grid gap-4 text-sm sm:grid-cols-2">{[["Customer", order.customerName], ["Member ID", order.memberId || "Walk-in"], ["Created", `${orderDate(order.createdAt)} WIB`], ["Payment method", order.paymentMethod || "Not paid"], ["Paid at", order.paidAt ? `${orderDate(order.paidAt)} WIB` : "Not paid"], ["Picked up at", order.pickedUpAt ? `${orderDate(order.pickedUpAt)} WIB` : "Not picked up"]].map(([label, value]) => <div key={label} className="min-w-0 break-words"><dt className="text-xs text-ink-muted">{label}</dt><dd className="mt-1 text-ink">{value}</dd></div>)}</dl><ul className="divide-y divide-line border-y border-line">{order.lines.map(line => <li key={line.productId} className="flex justify-between gap-4 py-4 text-sm"><div className="min-w-0"><p className="font-medium text-ink">{line.name}</p><p className="mt-1 break-all text-xs text-ink-muted">{line.sku} | {line.quantity} x {storeMoney(line.price)}</p></div><strong className="shrink-0 text-ink">{storeMoney(line.quantity * line.price)}</strong></li>)}</ul><dl className="space-y-3 text-sm text-ink">{[["Subtotal", order.subtotal], ["Discount", -order.discount], ["Tax", order.tax], ["Total", order.total]].map(([label, value]) => <div key={label} className={`flex justify-between gap-3 ${label === "Total" ? "border-t border-line pt-3 font-semibold" : ""}`}><dt>{label}</dt><dd>{storeMoney(Number(value))}</dd></div>)}</dl>{order.cancelReason && <p className="text-sm text-ink-muted">Cancellation: {order.cancelReason}</p>}</Card>
      <Card className="space-y-4 p-5"><h2 className="font-semibold text-ink">Process order</h2><StoreError message={error}/>{canPay && <><label className="block text-sm text-ink">Simulated payment method<Select className="mt-2" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as PaymentMethod)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</Select></label><Button className="w-full whitespace-normal" onClick={() => setConfirm("pay-order")}>Record mock payment</Button></>}{order.paymentStatus === "paid" && order.fulfillmentStatus === "preparing" && <Button className="w-full whitespace-normal" onClick={() => setConfirm("ready-order")}><PackageCheck size={17}/>Mark ready for pickup</Button>}{order.paymentStatus === "paid" && order.fulfillmentStatus === "ready_for_pickup" && <LinkButton className="w-full whitespace-normal" href={`/pos/pickup?order=${encodeURIComponent(order.id)}`}>Validate pickup QR</LinkButton>}{order.fulfillmentStatus === "picked_up" && <p className="flex gap-2 text-sm text-ink"><CheckCircle2 size={18} className="shrink-0 text-primary"/>Goods handover completed. Duplicate pickup is blocked.</p>}{!["picked_up", "cancelled"].includes(order.fulfillmentStatus) && <Button variant="danger" className="w-full whitespace-normal" onClick={() => setConfirm("cancel-order")}>Cancel mock order</Button>}<p className="text-xs leading-relaxed text-ink-muted">Payment, readiness, and pickup are separate states for member orders. Pickup requires paid + ready status and the correct Store QR.</p></Card></div>
    <ConfirmDialog open={!!confirm} title={confirm === "pay-order" ? "Record this payment?" : confirm === "ready-order" ? "Goods ready for pickup?" : "Cancel this mock order?"} description={confirm === "pay-order" ? `Simulate ${storeMoney(order.total)} via ${paymentMethod}. No real charge is made.` : confirm === "ready-order" ? "Confirm the paid order has been prepared for member collection." : "This releases its reservation or reverses its simulated payment. No real money is refunded."} confirmLabel={confirm === "cancel-order" ? "Cancel order" : "Confirm"} destructive={confirm === "cancel-order"} onClose={() => setConfirm(null)} onConfirm={processOrder}/>
  </div>;
}

export function CashierPickup({ initialOrderId = "" }: { initialOrderId?: string }) {
  const actor = useStoreActor(); const { state, dispatch, notify } = useStore();
  const branches = useStoreBranches();
  const allOrders = visibleOrders(state, actor);
  const initialOrder = allOrders.find(order => order.id === initialOrderId);
  const [branchId, setBranchId] = useState(initialOrder?.branchId || branches[0]?.id || "");
  const [orderId, setOrderId] = useState(initialOrderId); const [token, setToken] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [confirm, setConfirm] = useState(false);
  const orders = allOrders.filter(order => order.branchId === branchId);
  const order = orders.find(item => item.id === orderId);
  function pickup() {
    setConfirm(false); setError(""); setSuccess("");
    if (!order) { setError("Choose a permitted order and branch first."); return; }
    const result = dispatch({ type: "pickup-order", actor, orderId: order.id, token: token.trim(), branchId });
    if (result.error) { setError(result.error); return; }
    setSuccess(`Pickup verified for ${order.id}. Goods handover recorded locally; this QR cannot be used again.`); notify("Store pickup completed.");
  }
  return <div><PageHeader title="Store pickup scanner" description="Validate product pickup only. Gym check-in and PT attendance QR codes are not accepted."/><StoreTabs active="pickup"/>
    <div className="grid items-start gap-5 lg:grid-cols-2"><Card className="space-y-5 p-5"><h2 className="font-semibold text-ink">Simulate pickup QR scan</h2><p className="text-sm text-ink-muted">No camera access required. Paste a mock Store QR payload or load the selected order token to test validation.</p><label className="block text-sm text-ink">Pickup branch<Select className="mt-2" value={branchId} onChange={event => { setBranchId(event.target.value); setOrderId(""); setToken(""); setError(""); setSuccess(""); }}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></label><label className="block text-sm text-ink">Order<Select className="mt-2" value={orderId} onChange={event => { setOrderId(event.target.value); setToken(""); setError(""); setSuccess(""); }}><option value="">Select an order</option>{orders.map(item => <option key={item.id} value={item.id}>{item.id} | {item.customerName} | {readable(item.fulfillmentStatus)}</option>)}</Select></label><form className="space-y-4" onSubmit={event => { event.preventDefault(); setConfirm(true); }}><label className="block text-sm text-ink">Store QR payload<Textarea className="mt-2 min-h-24 resize-y font-mono text-xs" maxLength={180} value={token} onChange={event => { setToken(event.target.value); setError(""); setSuccess(""); }} placeholder="store-demo:..." required/></label><div className="flex flex-wrap gap-2"><Button type="submit" className="max-w-full whitespace-normal" disabled={!order || !token.trim()}>Validate QR &amp; hand over</Button><Button type="button" variant="secondary" className="max-w-full whitespace-normal" disabled={!order} onClick={() => { if (order) setToken(order.pickupToken); setError(""); setSuccess(""); }}>Load mock pickup QR</Button></div></form><StoreError message={error}/>{success && <p role="status" className="rounded-lg border border-primary bg-primary-tint p-4 text-sm text-ink">{success}</p>}</Card>
      <Card className="space-y-5 p-5"><h2 className="font-semibold text-ink">Order verification</h2>{order ? <><p className="break-all text-sm font-medium text-ink">{order.id}</p><p className="text-sm text-ink-muted">{order.customerName} | {branchName(order.branchId)}</p><OrderStatuses order={order}/><ul className="space-y-2 text-sm text-ink">{order.lines.map(line => <li key={line.productId}>{line.quantity} x {line.name}</li>)}</ul><p className="font-semibold text-ink">{storeMoney(order.total)}</p><LinkButton variant="secondary" className="max-w-full whitespace-normal" href={`/pos/orders/${order.id}`}>Open cashier order details</LinkButton></> : <EmptyState title="No order selected" description="Select an order from a branch you are authorized to serve."/>}<p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">The local validator checks order identity, token, branch, paid status, readiness and duplicate handover. A successful scan changes fulfillment to picked up exactly once. No backend record is written.</p></Card></div>
    <ConfirmDialog open={confirm} title="Validate pickup and hand over goods?" description="Only a paid order marked ready for pickup with the correct Store QR can be handed over. This is a local simulation." confirmLabel="Validate pickup" onClose={() => setConfirm(false)} onConfirm={pickup}/>
  </div>;
}
