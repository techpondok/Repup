"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveBranch } from "@/app/actions/tenant";
import type { Branch } from "@/types/database.types";
import { useBranchDemo } from "@/components/branches/demo-provider";
import { Select } from "@/components/ui/field";

export function BranchSwitcher({ branches, activeBranchId }: { branches: Branch[]; activeBranchId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const demo = useBranchDemo();

  if (demo) return <Select aria-label="Cabang aktif" className="min-w-0" value={demo.scope?.id ?? ""} onChange={event => demo.pick(event.target.value)}>
    {demo.owner && <option value="">All Branches</option>}
    {!demo.owner && !demo.active.length && <option value="">Tidak ada cabang aktif</option>}
    {demo.active.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
  </Select>;

  if (branches.length <= 1) {
    return branches[0] ? (
      <span className="text-sm font-medium text-ink">{branches[0].name}</span>
    ) : (
      <span className="text-sm text-ink-faint">Belum ada cabang</span>
    );
  }

  return (
    <select
      className="rounded-[6px] border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-primary disabled:opacity-60"
      value={activeBranchId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value;
        startTransition(async () => {
          await setActiveBranch(id);
          router.refresh();
        });
      }}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
