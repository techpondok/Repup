"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setActiveBranch(branchId: string) {
  const cookieStore = await cookies();
  cookieStore.set("ru_branch_id", branchId, { path: "/" });
  revalidatePath("/", "layout");
}

export async function setActiveOrganization(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set("ru_org_id", organizationId, { path: "/" });
  cookieStore.delete("ru_branch_id");
  revalidatePath("/", "layout");
}
