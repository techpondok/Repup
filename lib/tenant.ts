import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Branch, Gym, OrgRole, Organization, Profile } from "@/types/database.types";
import { DEMO_ROLES, getDemoRole, type DemoRole } from "@/lib/demo/roles";

export interface TenantContext {
  userId: string;
  profile: Profile;
  organizations: (Organization & { role: OrgRole })[];
  organization: Organization & { role: OrgRole };
  gyms: Gym[];
  branches: Branch[];
  branch: Branch | null;
  isOrgWide: boolean;
  isDemo: boolean;
  demoRole?: DemoRole;
}

/**
 * Resolves the authenticated user's tenant context: which organization is
 * "active" (from cookie, else first membership), the gyms/branches they can
 * see, and which branch is currently selected.
 *
 * Redirects to /login if unauthenticated, or /onboarding if the user has
 * no organization yet.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const cookieStore = await cookies();
  if (cookieStore.get("ru_demo")?.value === "1") {
    const role = getDemoRole(cookieStore.get("ru_demo_role")?.value);
    const roleConfig = DEMO_ROLES[role];
    const demoOrg = { id: "demo-org-powerhouse", name: "PowerHouse Fitness", legal_name: null, owner_id: "demo-user", billing_email: "demo@repup.local", onboarding_step: "complete", created_at: "", updated_at: "", archived_at: null, business_type: "gym_fitness_center", timezone: "Asia/Jakarta", currency: "IDR", is_demo: true } as any;
    const allBranches = ["Kediri", "Surabaya", "Malang"].map((name) => ({ id: `demo-location-${name.toLowerCase()}`, organization_id: demoOrg.id, gym_id: "demo-gym", name, code: name.slice(0, 3).toUpperCase(), address: null, phone: null, opening_hours: {}, status: "active", created_at: "", updated_at: "", archived_at: null })) as any[];
    const branches = roleConfig.locationIds ? allBranches.filter((branch) => roleConfig.locationIds?.includes(branch.id)) : allBranches;
    const branch = branches[0] ?? allBranches[0];
    const orgRole = role === "OWNER" ? "owner" : role === "ADMIN" ? "admin" : role === "MEMBER" ? "staff" : role === "COACH" || role === "TRAINER" ? "coach" : "manager";
    return { userId: `demo-${role.toLowerCase()}`, profile: { id: `demo-${role.toLowerCase()}`, full_name: role === "TRAINER" ? "Andi Wijaya" : "Yudha Demo", phone: null, avatar_url: null, is_super_admin: roleConfig.scope === "platform", is_demo_user: true, created_at: "", updated_at: "" } as any, organizations: [{ ...demoOrg, role: orgRole }], organization: { ...demoOrg, role: orgRole }, gyms: [{ id: "demo-gym", organization_id: demoOrg.id, name: "PowerHouse Fitness", logo_url: null, contact_phone: null, contact_email: null, address: null, timezone: "Asia/Jakarta", currency: "IDR", created_at: "", updated_at: "", archived_at: null } as any], branches, branch, isOrgWide: role === "OWNER" || role === "ADMIN", isDemo: true, demoRole: role };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const { data: memberships } = await supabase
    .from("organization_users")
    .select("role, organizations(*)")
    .eq("user_id", user.id);

  const organizations = (memberships ?? [])
    .filter((m: any) => m.organizations)
    .map((m: any) => ({ ...(m.organizations as Organization), role: m.role as OrgRole }));

  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  const activeOrgId = cookieStore.get("ru_org_id")?.value;
  const organization = organizations.find((o) => o.id === activeOrgId) ?? organizations[0];

  if (organization.onboarding_step !== "complete") {
    redirect("/onboarding");
  }

  const { data: gyms } = await supabase.from("gyms").select("*").eq("organization_id", organization.id);

  const isOrgWide = organization.role === "owner" || organization.role === "admin";

  let branches: Branch[] = [];
  if (isOrgWide) {
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at");
    branches = data ?? [];
  } else {
    const { data } = await supabase
      .from("branch_users")
      .select("branches(*)")
      .eq("organization_id", organization.id)
      .eq("user_id", user.id);
    branches = (data ?? []).map((r: any) => r.branches).filter(Boolean);
  }

  const activeBranchId = cookieStore.get("ru_branch_id")?.value;
  const branch = branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? null;

  return {
    userId: user.id,
    profile: (profile ?? { id: user.id, full_name: "", phone: null, avatar_url: null, is_super_admin: false, created_at: "", updated_at: "" }) as Profile,
    organizations,
    organization,
    gyms: gyms ?? [],
    branches,
    branch,
    isOrgWide,
    isDemo: false,
  };
}
