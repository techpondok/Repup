import { DataTable } from "@/components/ui/data-table";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-bits";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JoinRequestActions } from "@/components/members/join-request-actions";
import { formatDateTime } from "@/lib/format";

export default async function MemberRequestsPage() {
  const ctx = await getTenantContext();
  const supabase = await createClient();
  const [{ data: requests }, { data: members }] = await Promise.all([
    (supabase as any).from("member_join_requests").select("id, user_id, requested_at, status, branches(name), profiles(id, full_name, phone)").eq("organization_id", ctx.organization.id).eq("status", "pending").order("requested_at", { ascending: false }),
    supabase.from("members").select("id, full_name, member_code, phone, email, repup_account_id").eq("organization_id", ctx.organization.id).is("repup_account_id", null).neq("status", "archived").order("full_name"),
  ]);
  const visibleRequests = ctx.branch ? (requests ?? []).filter((request: any) => request.branches?.id === ctx.branch?.id || !request.branches?.id) : requests ?? [];

  return <div><PageHeader title="Permintaan Join" description="Tinjau user RepUp yang ingin terhubung ke member gym." actions={<LinkButton href="/members" variant="secondary">Kembali ke Members</LinkButton>} /><Card className="overflow-hidden">{visibleRequests.length === 0 ? <EmptyState title="Tidak ada permintaan pending" description="Permintaan join baru akan muncul di sini." /> : <div className="overflow-x-auto"><DataTable className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">Requested Branch</th><th className="px-4 py-3 font-medium">Requested At</th><th className="px-4 py-3 font-medium">Existing Match</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead><tbody>{visibleRequests.map((request: any) => { const profile = request.profiles; const matches = (members ?? []).filter((member: any) => (profile?.phone && member.phone === profile.phone) || (profile?.full_name && member.full_name.toLowerCase() === profile.full_name.toLowerCase())); return <tr key={request.id} className="border-b border-line last:border-0"><td className="px-4 py-4"><p className="font-medium text-ink">{profile?.full_name ?? "User RepUp"}</p><p className="text-xs text-ink-faint">{profile?.id}</p></td><td className="px-4 py-4 text-ink-muted">{profile?.phone ?? "-"}</td><td className="px-4 py-4 text-ink-muted">{request.branches?.name ?? "-"}</td><td className="px-4 py-4 text-ink-muted">{formatDateTime(request.requested_at)}</td><td className="px-4 py-4">{matches.length ? <div><Badge tone="warning">Potential existing member</Badge><p className="mt-1 text-xs text-ink-muted">{matches.map((match: any) => match.member_code).join(", ")}</p></div> : <span className="text-ink-faint">Tidak ditemukan</span>}</td><td className="px-4 py-4"><JoinRequestActions requestId={request.id} members={matches.length ? matches : (members ?? [])} /></td></tr>; })}</tbody></DataTable></div>}</Card></div>;
}
