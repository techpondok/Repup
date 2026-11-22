import { CreateClassForm } from "@/components/classes/create-class-form";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout-bits";
import { hasDemoPermission } from "@/lib/demo/roles";
import { getTenantContext } from "@/lib/tenant";

export default async function CreateClassPage() {
  const ctx = await getTenantContext();
  if (!ctx.isDemo || !hasDemoPermission(ctx.demoRole, "classes.manage")) {
    return <EmptyState title="Create Class is available in the demo workspace" description="Open the demo as Owner, Admin, or Manager to create a simulated class."
      action={<LinkButton href="/classes" variant="secondary">Back to Classes</LinkButton>} />;
  }
  return <CreateClassForm branches={ctx.branches.map(branch => ({ id: branch.id, name: branch.name }))} defaultBranch={ctx.branch?.id ?? ""} />;
}
