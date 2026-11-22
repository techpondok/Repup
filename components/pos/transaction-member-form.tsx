"use client";

import { useActionState } from "react";
import { changeTransactionMember } from "@/app/actions/pos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function TransactionMemberForm({ transactionId, currentMemberCode, currentMemberId }: {
  transactionId: string;
  currentMemberCode: string;
  currentMemberId: string | null;
}) {
  const [result, action, pending] = useActionState(changeTransactionMember.bind(null, transactionId, currentMemberId), null);
  return <form action={action} className="mt-5 space-y-3 border-t border-line pt-4">
    <label className="block text-sm font-medium text-ink">Change transaction member
      <Input className="mt-2" name="memberCode" defaultValue={currentMemberCode} maxLength={80} placeholder="Member number" disabled={pending} />
    </label>
    <p className="text-xs text-ink-muted">Leave empty for Walk-in Customer.</p>
    <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save customer"}</Button>
    {result && <p role={result.error ? "alert" : "status"} className={result.error ? "text-sm text-danger" : "text-sm text-success"}>{result.error ?? "Customer updated."}</p>}
  </form>;
}
