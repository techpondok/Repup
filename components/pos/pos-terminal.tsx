"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, User, X } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/layout-bits";
import { formatCurrency } from "@/lib/format";
import { checkoutSale, searchMembersForPos, type CartItem } from "@/app/actions/pos";

interface SellableItem {
  id: string;
  name: string;
  price: number;
  category: string;
  membership_plan_id?: string | null;
  product_id?: string | null;
}

interface MemberHit {
  id: string;
  full_name: string;
  member_code: string;
  phone: string | null;
}

export function PosTerminal({
  organizationId,
  gymId,
  branchId,
  items,
  currency,
}: {
  organizationId: string;
  gymId: string;
  branchId: string;
  items: SellableItem[];
  currency: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberHit[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null);
  const [cart, setCart] = useState<(CartItem & { key: string })[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "qris" | "other">("cash");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ invoice_number: string } | null>(null);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const total = Math.max(subtotal - discount, 0);

  function addToCart(item: SellableItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.key === item.id && !item.membership_plan_id);
      if (existing && !item.membership_plan_id) {
        return prev.map((c) => (c.key === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          key: item.id + "-" + prev.length,
          description: item.name,
          quantity: 1,
          unit_price: item.price,
          product_id: item.product_id ?? null,
          membership_plan_id: item.membership_plan_id ?? null,
        },
      ];
    });
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }

  async function runMemberSearch(q: string) {
    setMemberQuery(q);
    if (q.trim().length < 2) {
      setMemberResults([]);
      return;
    }
    const res = await searchMembersForPos(organizationId, branchId, q);
    setMemberResults(res as MemberHit[]);
  }

  function handleCheckout() {
    setError(null);
    const hasMembership = cart.some((c) => c.membership_plan_id);
    if (hasMembership && !selectedMember) {
      setError("Pilih member terlebih dahulu untuk pembelian membership.");
      return;
    }
    startTransition(async () => {
      const res = await checkoutSale({
        organization_id: organizationId,
        gym_id: gymId,
        branch_id: branchId,
        member_id: selectedMember?.id ?? null,
        items: cart.map(({ key, ...rest }) => rest),
        discount,
        tax: 0,
        payment_method: paymentMethod,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setSuccess({ invoice_number: res.invoice_number! });
      setCart([]);
      setDiscount(0);
      setSelectedMember(null);
      router.refresh();
    });
  }

  if (success) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-tint text-success">
          ✓
        </div>
        <h2 className="text-base font-semibold text-ink">Pembayaran Berhasil</h2>
        <p className="num mt-1 text-sm text-ink-muted">{success.invoice_number}</p>
        <Button className="mt-6 w-full" onClick={() => setSuccess(null)}>
          Transaksi Baru
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="relative mb-4">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Cari produk atau paket..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {categories.map((cat) => {
          const catItems = filtered.filter((i) => i.category === cat);
          if (!catItems.length) return null;
          return (
            <div key={cat} className="mb-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{cat}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-primary-tint/40"
                  >
                    <p className="text-sm font-medium text-ink">{item.name}</p>
                    <p className="num mt-1 text-sm text-ink-muted">{formatCurrency(item.price, currency)}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-ink-faint">Tidak ada produk ditemukan.</p>}
      </div>

      <Card className="flex h-fit flex-col p-4">
        <p className="mb-3 text-sm font-medium text-ink">Keranjang</p>

        {selectedMember ? (
          <div className="mb-3 flex items-center justify-between rounded-[6px] bg-primary-tint px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-primary">
              <User size={14} />
              <span className="font-medium">{selectedMember.full_name}</span>
            </div>
            <button onClick={() => setSelectedMember(null)}>
              <X size={14} className="text-primary" />
            </button>
          </div>
        ) : (
          <div className="relative mb-3">
            <Input
              placeholder="Cari member (opsional untuk walk-in)"
              value={memberQuery}
              onChange={(e) => runMemberSearch(e.target.value)}
            />
            {memberResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-line bg-surface py-1 shadow-sm">
                {memberResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMember(m);
                      setMemberResults([]);
                      setMemberQuery("");
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-canvas"
                  >
                    <span className="font-medium">{m.full_name}</span>{" "}
                    <span className="num text-xs text-ink-faint">{m.member_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-h-64 flex-1 space-y-2 overflow-y-auto">
          {cart.length === 0 && <p className="py-8 text-center text-sm text-ink-faint">Belum ada item</p>}
          {cart.map((item) => (
            <div key={item.key} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-ink">{item.description}</p>
                <p className="num text-xs text-ink-faint">
                  {item.quantity} × {formatCurrency(item.unit_price, currency)}
                </p>
              </div>
              <button onClick={() => removeFromCart(item.key)} className="text-ink-faint hover:text-danger">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Subtotal</span>
            <span className="num">{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Diskon</span>
            <Input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="w-28 text-right"
            />
          </div>
          <div className="flex justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span className="num">{formatCurrency(total, currency)}</span>
          </div>
        </div>

        <div className="mt-4">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
            <option value="cash">Tunai</option>
            <option value="transfer">Transfer</option>
            <option value="qris">QRIS</option>
            <option value="other">Lainnya</option>
          </Select>
        </div>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <Button className="mt-4 w-full" size="md" disabled={cart.length === 0 || pending} onClick={handleCheckout}>
          {pending ? "Memproses..." : "Selesaikan Pembayaran"}
        </Button>
      </Card>
    </div>
  );
}
