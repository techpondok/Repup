import { BranchWorkspace } from "@/components/branches/workspace";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <BranchWorkspace detailId={id} initialTab={tab === "staff" ? "Staff & Trainers" : undefined} />;
}
