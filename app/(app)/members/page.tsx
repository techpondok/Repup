import { DemoMemberList } from "@/components/members/demo-list";
import { memberDemoScope } from "@/components/members/demo-scope";
import { DataTable } from "@/components/ui/data-table";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Card, Stat } from "@/components/ui/layout-bits";
import { LinkButton } from "@/components/ui/button";
import { NewMemberDialog } from "@/components/members/new-member-dialog";
import { PairingCodeButton } from "@/components/members/pairing-code-button";
import { Input, Select } from "@/components/ui/field";
import { Badge, MemberStatusBadge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { Search, UserPlus } from "lucide-react";

const PAGE_SIZE = 20;

function AccountBadge({ member }: { member: any }) {
  return member.repup_account_id ? <Badge tone="success">Connected</Badge> : <Badge tone="neutral">Belum Terhubung</Badge>;
}

function MemberAvatar({ name }: { name: string }) {
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">{name.slice(0, 2).toUpperCase()}</div>;
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; connection?: string; page?: string }> }) {
  const ctx = await getTenantContext();
  const sp = await searchParams;
  if (ctx.isDemo) return <DemoMemberList {...memberDemoScope(ctx)} />;
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const scope = (query: any) => {
    let scoped = query.eq("organization_id", ctx.organization.id).neq("status", "archived");
    if (ctx.branch) scoped = scoped.eq("branch_id", ctx.branch.id);
    return scoped;
  };
  let query = scope(supabase.from("members").select("*", { count: "exact" }).order("created_at", { ascending: false }));
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.connection === "connected") query = query.not("repup_account_id", "is", null);
  if (sp.connection === "unlinked") query = query.is("repup_account_id", null);
  if (sp.q) query = query.or(`full_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,email.ilike.%${sp.q}%,member_code.ilike.%${sp.q}%`);

  const [{ data: members, count }, { data: plans }, { count: pendingRequests }] = await Promise.all([
    query.range(from, to),
    supabase.from("membership_plans").select("id, name, price").eq("organization_id", ctx.organization.id).eq("is_active", true).order("name"),
    (supabase as any).from("member_join_requests").select("id", { count: "exact", head: true }).eq("organization_id", ctx.organization.id).eq("status", "pending").eq(ctx.branch ? "branch_id" : "organization_id", ctx.branch?.id ?? ctx.organization.id),
  ]);
  const memberIds = (members ?? []).map((member: any) => member.id);
  const [{ data: memberships }, { data: latestCheckins }] = memberIds.length ? await Promise.all([
    supabase.from("memberships").select("member_id, end_date, status, membership_plans(name)").in("member_id", memberIds).in("status", ["active", "expiring_soon"]).order("end_date", { ascending: true }),
    supabase.from("check_ins").select("member_id, occurred_at").in("member_id", memberIds).eq("status", "success").order("occurred_at", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  const allScope = (status?: string) => {
    let scoped = supabase.from("members").select("id, repup_account_id, status", { count: "exact", head: true }).eq("organization_id", ctx.organization.id).neq("status", "archived");
    if (ctx.branch) scoped = scoped.eq("branch_id", ctx.branch.id);
    if (status) scoped = scoped.eq("status", status);
    return scoped;
  };
  const [{ count: total }, { count: active }, { count: expiring }, { count: unlinked }] = await Promise.all([allScope(), allScope("active"), allScope("expiring_soon"), allScope().is("repup_account_id", null)]);
  const latestCheckin = new Map<string, string>();
  for (const checkin of latestCheckins ?? []) if (!latestCheckin.has((checkin as any).member_id)) latestCheckin.set((checkin as any).member_id, (checkin as any).occurred_at);
  const membershipsByMember = new Map<string, any>();
  for (const membership of memberships ?? []) if (!membershipsByMember.has((membership as any).member_id)) membershipsByMember.set((membership as any).member_id, membership);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const queryString = (nextPage: number) => new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), ...(sp.connection ? { connection: sp.connection } : {}), page: String(nextPage) }).toString();
  const formProps = { organizationId: ctx.organization.id, gymId: ctx.branch?.gym_id ?? "", branchId: ctx.branch?.id ?? "", plans: (plans ?? []) as any };

  return <div className="mx-auto w-full max-w-[1400px]">
    <PageHeader title="Members" description="Kelola member gym, membership, akun RepUp, pembayaran, dan aktivitas." actions={<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><LinkButton href="/members/requests" variant="secondary"><UserPlus size={16} /> Permintaan Join{pendingRequests ? ` (${pendingRequests})` : ""}</LinkButton><NewMemberDialog {...formProps} /></div>} />
    <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-md border border-line bg-surface sm:grid-cols-3 md:mb-6 md:grid-cols-5"><Stat label="Total Member" value={(total ?? 0).toLocaleString("id-ID")} /><Stat label="Active" value={(active ?? 0).toLocaleString("id-ID")} /><Stat label="Expiring Soon" value={(expiring ?? 0).toLocaleString("id-ID")} /><Stat label="Belum Terhubung" value={(unlinked ?? 0).toLocaleString("id-ID")} /><Stat label="Join Request" value={(pendingRequests ?? 0).toLocaleString("id-ID")} /></div>
    <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_11rem_auto] sm:items-center" action="/members"><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" /><Input name="q" defaultValue={sp.q} placeholder="Cari nama, telepon, email, member ID..." className="pl-9" /></div><Select name="connection" defaultValue={sp.connection ?? ""}><option value="">Semua akun</option><option value="connected">Connected</option><option value="unlinked">Belum Terhubung</option></Select><Select name="status" defaultValue={sp.status ?? ""}><option value="">Semua status</option><option value="active">Aktif</option><option value="expiring_soon">Segera Berakhir</option><option value="expired">Kadaluarsa</option><option value="suspended">Ditangguhkan</option><option value="visitor">Pengunjung</option></Select><button type="submit" className="min-h-10 rounded-[6px] border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted hover:bg-canvas">Filter</button></form>
    <Card className="overflow-hidden">
      {!members || members.length === 0 ? <EmptyState title="Belum ada member" description="Tambahkan member pertama atau tunggu user RepUp bergabung ke gym." action={<div className="flex flex-col gap-2 sm:flex-row"><NewMemberDialog {...formProps} /><LinkButton href="/members/requests" variant="secondary">Lihat Permintaan Join</LinkButton></div>} /> : <>
        <div className="divide-y divide-line md:hidden">{(members as any[]).map((m) => { const membership = membershipsByMember.get(m.id); return <article key={m.id} className="p-4"><div className="flex items-start gap-3"><Link href={`/members/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3"><MemberAvatar name={m.full_name} /><div className="min-w-0"><p className="truncate font-semibold text-ink">{m.full_name}</p><p className="num mt-0.5 text-xs text-ink-faint">{m.member_code}</p></div></Link><AccountBadge member={m} /></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><p className="text-ink-faint">Membership</p><p className="mt-1 truncate font-medium text-ink">{membership?.membership_plans?.name ?? "Belum ada paket"}</p></div><div><p className="text-ink-faint">Status</p><div className="mt-1"><MemberStatusBadge status={m.status} /></div></div><div><p className="text-ink-faint">Berakhir</p><p className="mt-1 text-ink-muted">{formatDate(membership?.end_date)}</p></div><div><p className="text-ink-faint">Check-in terakhir</p><p className="mt-1 text-ink-muted">{latestCheckin.has(m.id) ? formatDateTime(latestCheckin.get(m.id)) : "-"}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-line pt-3"><Link href={`/members/${m.id}`} className="text-sm font-medium text-primary">Lihat detail</Link>{!m.repup_account_id && <PairingCodeButton memberId={m.id} compact />}</div></article>; })}</div>
        <div className="hidden overflow-x-auto md:block"><DataTable className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-line text-left text-xs text-ink-faint"><th className="px-4 py-3 font-medium">Member</th><th className="px-4 py-3 font-medium">RepUp Account</th><th className="px-4 py-3 font-medium">Membership</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-4 py-3 font-medium">End Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Last Check-in</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead><tbody>{(members as any[]).map((m) => { const membership = membershipsByMember.get(m.id); return <tr key={m.id} className="border-b border-line last:border-0 hover:bg-canvas"><td className="px-4 py-3"><Link href={`/members/${m.id}`} className="flex items-center gap-3"><MemberAvatar name={m.full_name} /><div><p className="font-medium text-ink">{m.full_name}</p><p className="num text-xs text-ink-faint">{m.member_code}</p></div></Link></td><td className="px-4 py-3"><AccountBadge member={m} /></td><td className="px-4 py-3 text-ink-muted">{membership?.membership_plans?.name ?? "-"}</td><td className="px-4 py-3 text-ink-muted">{ctx.branches.find((b) => b.id === m.branch_id)?.name ?? "-"}</td><td className="px-4 py-3 text-ink-muted">{formatDate(membership?.end_date)}</td><td className="px-4 py-3"><MemberStatusBadge status={m.status} /></td><td className="px-4 py-3 text-ink-muted">{latestCheckin.has(m.id) ? formatDateTime(latestCheckin.get(m.id)) : "-"}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><Link href={`/members/${m.id}`} className="text-xs font-medium text-primary hover:underline">Detail</Link>{!m.repup_account_id && <PairingCodeButton memberId={m.id} compact />}</div></td></tr>; })}</tbody></DataTable></div>
      </>}
    </Card>
    {totalPages > 1 && <div className="mt-4 flex items-center justify-center gap-2 text-sm">{Array.from({ length: totalPages }).map((_, i) => <Link key={i} href={`/members?${queryString(i + 1)}`} className={`min-w-9 rounded-[6px] px-3 py-2 text-center ${page === i + 1 ? "bg-primary text-primary-foreground" : "text-ink-muted hover:bg-canvas"}`}>{i + 1}</Link>)}</div>}
  </div>;
}
