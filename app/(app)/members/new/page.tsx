import { getTenantContext } from "@/lib/tenant";
import { NewMemberForm } from "@/components/members/new-member-form";
import { EmptyState } from "@/components/ui/layout-bits";

export default async function NewMemberPage() {
  const ctx = await getTenantContext();

  if (!ctx.branch) {
    return (
      <EmptyState
        title="Belum ada cabang"
        description="Buat cabang terlebih dahulu sebelum menambahkan member."
      />
    );
  }

  return <NewMemberForm organizationId={ctx.organization.id} gymId={ctx.branch.gym_id} branchId={ctx.branch.id} />;
}
