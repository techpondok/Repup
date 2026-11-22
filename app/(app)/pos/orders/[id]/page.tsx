import { StoreStaffBoundary } from "@/components/store/staff-boundary";
import { CashierOrderDetail } from "@/components/store/cashier-store";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoreStaffBoundary mode="cashier"><CashierOrderDetail id={id} /></StoreStaffBoundary>;
}
