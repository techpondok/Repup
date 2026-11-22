import { StoreStaffBoundary } from "@/components/store/staff-boundary";
import { CashierPickup } from "@/components/store/cashier-store";

export default async function Page({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <StoreStaffBoundary mode="cashier"><CashierPickup initialOrderId={order || ""} /></StoreStaffBoundary>;
}
