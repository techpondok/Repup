import { notFound } from "next/navigation";
import { DemoMemberList } from "@/components/members/demo-list";
import { memberDemoScope } from "@/components/members/demo-scope";
import { getTenantContext } from "@/lib/tenant";

export default async function ExpiringSoonPage() {
  const ctx = await getTenantContext();
  if (!ctx.isDemo) notFound();
  return <DemoMemberList {...memberDemoScope(ctx)} expiring />;
}
