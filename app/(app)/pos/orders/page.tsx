import { StoreStaffBoundary } from "@/components/store/staff-boundary";
import { CashierOrders } from "@/components/store/cashier-store";

export default function Page() {
  return <StoreStaffBoundary mode="cashier"><CashierOrders /></StoreStaffBoundary>;
}
