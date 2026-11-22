import { MemberDemoProvider } from "@/components/members/demo-provider";
import { day } from "@/lib/demo/member-management";
import { getTenantContext } from "@/lib/tenant";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { resetDemo } from "@/app/actions/auth";
import { getDemoRole, DEMO_ROLES } from "@/lib/demo/roles";
import { DemoRoleSwitcher } from "@/components/layout/demo-role-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  if (ctx.isDemo && ctx.demoRole === "MEMBER") redirect("/member/dashboard");

  return (
    <div className="app-shell min-h-dvh bg-canvas">
      <Sidebar ctx={ctx} />
      <a href="#main-content" className="sr-only z-[110] rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Lewati ke konten</a>
      <div className="app-workspace flex min-h-dvh min-w-0 flex-col">
        <Topbar ctx={ctx} />
        <MobileNav ctx={ctx} />
        {ctx.isDemo && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-primary-tint px-4 py-2 text-xs text-ink-muted sm:px-6 lg:px-8"><span><strong className="font-semibold text-primary">Demo mode</strong> · Data contoh · Peran: {DEMO_ROLES[ctx.demoRole ?? getDemoRole(undefined)].name}</span><div className="flex flex-wrap items-center gap-3"><DemoRoleSwitcher role={ctx.demoRole ?? "OWNER"} names={Object.fromEntries(Object.entries(DEMO_ROLES).map(([key, value]) => [key, value.name])) as Record<keyof typeof DEMO_ROLES, string>} /><form action={resetDemo}><button type="submit" className="font-medium hover:underline">Reset demo</button></form><a href="/register" className="font-medium hover:underline">Mulai RepUp →</a></div></div>}
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">{ctx.isDemo ? <MemberDemoProvider initialDay={day()}>{children}</MemberDemoProvider> : children}</main>
      </div>
    </div>
  );
}
