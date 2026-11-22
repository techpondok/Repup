"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormModal } from "@/components/ui/form-modal";
import {
  freezeMembership,
  unfreezeMembership,
  cancelMembership,
  extendMembership,
} from "@/app/actions/memberships";

export function MembershipActions({
  membershipId,
  organizationId,
  status,
}: {
  membershipId: string;
  organizationId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function run(fn: () => Promise<any>) {
    startTransition(async () => {
      await fn();
      router.refresh();
      setOpen(false);
    });
  }

  if (status === "cancelled" || status === "expired") {
    return <span className="text-xs text-ink-faint">-</span>;
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="rounded-[6px] border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-canvas"
      >
        Kelola
      </button>
      {open && (
        <FormModal open={open} title="Kelola membership" size="small" trigger={null} onClose={() => setOpen(false)}>
          {status === "active" && (
            <button
              onClick={() => run(() => freezeMembership(membershipId, organizationId))}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas"
            >
              Bekukan
            </button>
          )}
          {status === "frozen" && (
            <button
              onClick={() => run(() => unfreezeMembership(membershipId, organizationId))}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas"
            >
              Aktifkan Kembali
            </button>
          )}
          <button
            onClick={() => run(() => extendMembership(membershipId, organizationId, 7))}
            className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-canvas"
          >
            Perpanjang 7 Hari
          </button>
          <button
            onClick={() => run(() => cancelMembership(membershipId, organizationId))}
            className="block w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger-tint"
          >
            Batalkan
          </button>
        </FormModal>
      )}
    </div>
  );
}
