import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_ROLES, getDemoRole } from "@/lib/demo/roles";
import { getTenantContext } from "@/lib/tenant";

export default async function PlatformDemoPage() {
  const cookieStore = await cookies();
  if (process.env.APP_DEMO_ENABLED === "false" || cookieStore.get("ru_demo")?.value !== "1") redirect("/demo");
  const ctx = await getTenantContext();
  const role = getDemoRole(cookieStore.get("ru_demo_role")?.value);
  if (DEMO_ROLES[role].scope !== "platform") redirect("/dashboard");
  const metrics = [["Organizations", "128"], ["Active businesses", "114"], ["Locations", "263"], ["Members managed", "48,291"], ["MRR", "Rp57.4M"], ["Trials", "14"]];
  return <main className="min-h-screen bg-canvas p-8 text-ink"><div className="mx-auto max-w-6xl"><div className="mb-10 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">DEMO MODE · REPUP PLATFORM</p><h1 className="mt-2 text-3xl font-semibold">Platform dashboard</h1><p className="mt-1 text-sm text-ink-muted">Signed in as {DEMO_ROLES[role].name}.</p></div><Link href="/demo" className="rounded border border-line-strong px-3 py-2 text-sm text-ink-muted hover:bg-surface">Switch role</Link></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3">{metrics.map(([label, value]) => <div key={label} className="rounded border border-line bg-surface p-5"><p className="text-xs text-ink-muted">{label}</p><p className="num mt-3 text-2xl font-semibold">{value}</p></div>)}</div><div className="mt-6 rounded border border-line bg-surface p-5"><h2 className="font-semibold">Platform workspace</h2><div className="mt-4 grid gap-3 text-sm text-ink-muted md:grid-cols-2"><p>Organizations and demo workspaces</p><p>Subscriptions, trials, and billing</p><p>Support cases and audit logs</p><p>Feature flags and system health</p></div></div></div></main>;
}
