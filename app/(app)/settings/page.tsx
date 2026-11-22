import { getTenantContext } from "@/lib/tenant";
import { PageHeader, Card, SectionLabel } from "@/components/ui/layout-bits";
import { OrganizationSettingsForm, GymSettingsForm } from "@/components/settings/settings-forms";
import { PtSettingsForm } from "@/components/personal-training/pt-settings";
import { loadPtSettings } from "@/app/actions/pt-bookings";
import { LinkButton } from "@/components/ui/button";

export default async function SettingsPage() {
  const ctx = await getTenantContext();
  const gym = ctx.gyms.find((g) => g.id === ctx.branch?.gym_id) ?? ctx.gyms[0];
  const canConfigurePt = !!gym && ctx.isOrgWide && !ctx.isDemo;
  const ptSettings = canConfigurePt ? await loadPtSettings().catch(() => null) : null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Pengaturan" description="Kelola profil organisasi, gym, dan preferensi lainnya." />

      <div className="space-y-6">
        {ctx.isDemo && ctx.demoRole === "OWNER" && <div className="flex flex-wrap gap-2"><LinkButton href="/branches" variant="secondary">Branch Management</LinkButton><LinkButton href="/dashboard/settings/subscription" variant="secondary">Subscription</LinkButton></div>}
        <Card className="p-6">
          <SectionLabel>Organisasi</SectionLabel>
          <OrganizationSettingsForm organization={ctx.organization} />
        </Card>

        {gym && (
          <Card className="p-6">
            <SectionLabel>Gym</SectionLabel>
            <GymSettingsForm gym={gym} />
          </Card>
        )}

        {canConfigurePt && (
          <Card className="p-6">
            <SectionLabel>Personal Training</SectionLabel>
            <PtSettingsForm key={gym?.id} initial={ptSettings} />
          </Card>
        )}

        <Card className="p-6">
          <SectionLabel>Lainnya</SectionLabel>
          <ul className="divide-y divide-line text-sm">
            {["Pembayaran", "Check-in", "Staff & Izin Akses", "Invoice", "Notifikasi"].map((s) => (
              <li key={s} className="flex items-center justify-between py-3">
                <span className="text-ink">{s}</span>
                <span className="text-xs text-ink-faint">Segera hadir</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
