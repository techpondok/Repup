import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Card } from "@/components/ui/layout-bits";
import { LinkButton } from "@/components/ui/button";
import { NewMemberDialog } from "@/components/members/new-member-dialog";
import { Input, Select } from "@/components/ui/field";
import { MemberStatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Search } from "lucide-react";

const PAGE_SIZE = 20;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const ctx = await getTenantContext();
  const sp = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, Number(sp.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("members")
    .select("*", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (ctx.branch) query = query.eq("branch_id", ctx.branch.id);
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.q) query = query.or(`full_name.ilike.%${sp.q}%,phone.ilike.%${sp.q}%,email.ilike.%${sp.q}%,member_code.ilike.%${sp.q}%`);

  const { data: members, count } = await query.range(from, to);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Member"
        description={`${count ?? 0} member terdaftar di ${ctx.branch?.name ?? ctx.organization.name}`}
        actions={
          <NewMemberDialog organizationId={ctx.organization.id} gymId={ctx.branch?.gym_id ?? ""} branchId={ctx.branch?.id ?? ""} />
        }
      />

      <form className="mb-4 flex items-center gap-3" action="/members">
        <div className="relative w-72">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input name="q" defaultValue={sp.q} placeholder="Cari nama, telepon, email..." className="pl-8" />
        </div>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-48">
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="expiring_soon">Segera Berakhir</option>
          <option value="expired">Kadaluarsa</option>
          <option value="suspended">Ditangguhkan</option>
          <option value="visitor">Pengunjung</option>
        </Select>
        <button type="submit" className="rounded-[6px] border border-line-strong px-3 py-2 text-sm text-ink-muted hover:bg-canvas">
          Filter
        </button>
      </form>

      <Card>
        {!members || members.length === 0 ? (
          <EmptyState
            title="Belum ada member"
            description="Tambahkan member pertama Anda untuk mulai mengelola keanggotaan gym."
            action={
              <NewMemberDialog organizationId={ctx.organization.id} gymId={ctx.branch?.gym_id ?? ""} branchId={ctx.branch?.id ?? ""} />
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Telepon</th>
                <th className="px-4 py-3 font-medium">Cabang</th>
                <th className="px-4 py-3 font-medium">Bergabung</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} className="border-b border-line last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <Link href={`/members/${m.id}`} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold text-primary">
                        {m.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{m.full_name}</p>
                        <p className="num text-xs text-ink-faint">{m.member_code}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{m.phone || "-"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {ctx.branches.find((b) => b.id === m.branch_id)?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(m.join_date)}</td>
                  <td className="px-4 py-3">
                    <MemberStatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPages }).map((_, i) => (
            <Link
              key={i}
              href={`/members?page=${i + 1}${sp.q ? `&q=${sp.q}` : ""}${sp.status ? `&status=${sp.status}` : ""}`}
              className={`rounded-[6px] px-3 py-1.5 ${page === i + 1 ? "bg-primary text-primary-foreground" : "text-ink-muted hover:bg-canvas"}`}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
