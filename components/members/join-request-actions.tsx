"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reviewJoinRequest } from "@/app/actions/members";

export function JoinRequestActions({ requestId, members }: { requestId: string; members: { id: string; full_name: string; member_code: string; phone: string | null }[] }) {
  const [memberId, setMemberId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function review(decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await reviewJoinRequest(requestId, decision, decision === "approved" ? memberId : undefined);
      setMessage(result.error ?? (decision === "approved" ? "Akun berhasil dihubungkan." : "Permintaan ditolak."));
    });
  }
  return <div className="flex flex-wrap items-center justify-end gap-2"><select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="rounded-[6px] border border-line-strong bg-surface px-2 py-1.5 text-xs text-ink"><option value="">Pilih existing member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name} · {member.member_code}</option>)}</select><Button size="sm" onClick={() => review("approved")} disabled={pending || !memberId}>{pending ? "Memproses..." : "Hubungkan"}</Button><Button size="sm" variant="danger" onClick={() => review("rejected")} disabled={pending}>Tolak</Button>{message && <span className="text-xs text-ink-muted">{message}</span>}</div>;
}
