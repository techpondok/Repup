import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { liveAuthEnabled } from "@/lib/auth-mode";

export default async function OnboardingPage() {
  if (!liveAuthEnabled()) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_users")
    .select("organizations(id, onboarding_step, name)")
    .eq("user_id", user.id);

  const existing = (memberships ?? []).map((m: any) => m.organizations).find(Boolean);

  if (existing?.onboarding_step === "complete") {
    redirect("/dashboard");
  }

  let existingGymId: string | null = null;
  if (existing?.id) {
    const { data: gym } = await supabase.from("gyms").select("id").eq("organization_id", existing.id).limit(1).single();
    existingGymId = gym?.id ?? null;
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-xl">
        <p className="mb-8 text-center text-[15px] font-semibold tracking-tight text-ink">RepUp Gym</p>
        <OnboardingWizard
          existingOrganizationId={existing?.id ?? null}
          existingGymId={existingGymId}
        />
      </div>
    </div>
  );
}
