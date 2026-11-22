import { EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { getTenantContext } from "@/lib/tenant";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  if (!ctx.isDemo) return <><PageHeader title="Payroll Management" /><EmptyState title="Payroll preview is available in demo mode." /></>;
  return children;
}
