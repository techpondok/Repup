import { getTenantContext } from "@/lib/tenant";
import { NewPlanForm } from "@/components/memberships/new-plan-form";

export default async function NewPlanPage() {
  const ctx = await getTenantContext();
  const gymId = ctx.branch?.gym_id ?? ctx.gyms[0]?.id ?? "";

  return <NewPlanForm organizationId={ctx.organization.id} gymId={gymId} branches={ctx.branches} />;
}
