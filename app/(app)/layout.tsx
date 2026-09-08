import { getTenantContext } from "@/lib/tenant";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { resetDemo } from "@/app/actions/auth";
import { getDemoRole, DEMO_ROLES } from "@/lib/demo/roles";
import { DemoRoleSwitcher } from "@/components/layout/demo-role-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-canvas">
      <Sidebar ctx={ctx} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar ctx={ctx} />
        {ctx.isDemo && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary bg-primary-tint px-6 py-2 text-xs text-primary"><span><strong>DEMO MODE</strong> · Anda sedang menggunakan data contoh. · Peran: {DEMO_ROLES[ctx.demoRole ?? getDemoRole(undefined)].name}</span><div className="flex items-center gap-3"><DemoRoleSwitcher role={ctx.demoRole ?? "OWNER"} names={Object.fromEntries(Object.entries(DEMO_ROLES).map(([key, value]) => [key, value.name])) as Record<keyof typeof DEMO_ROLES, string>} /><form action={resetDemo}><button type="submit" className="font-medium hover:underline">Reset demo</button></form><a href="/register" className="font-medium hover:underline">Mulai RepUp →</a></div></div>}
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
