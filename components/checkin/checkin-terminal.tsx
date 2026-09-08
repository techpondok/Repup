"use client";

import { useState, useTransition } from "react";
import { Search, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/layout-bits";
import { formatDate } from "@/lib/format";
import { checkInMember, searchMembersForCheckIn, type CheckInResult } from "@/app/actions/checkin";

interface MemberHit {
  id: string;
  full_name: string;
  member_code: string;
  phone: string | null;
}

export function CheckinTerminal({ organizationId, branchId, branchName }: { organizationId: string; branchId: string; branchName: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberHit[]>([]);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CheckInResult | null>(null);

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await searchMembersForCheckIn(organizationId, q);
    setResults(res as MemberHit[]);
  }

  function handleCheckIn(memberId: string) {
    setResults([]);
    setQuery("");
    startTransition(async () => {
      const res = await checkInMember(memberId, branchId, "search");
      setResult(res);
    });
  }

  if (result) {
    const success = result.result_status === "success";
    return (
      <Card className={`mx-auto max-w-md p-8 text-center ${success ? "" : ""}`}>
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            success ? "bg-success-tint text-success" : "bg-danger-tint text-danger"
          }`}
        >
          {success ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
        </div>
        {success ? (
          <>
            <h2 className="text-lg font-semibold text-ink">CHECK-IN BERHASIL</h2>
            <p className="mt-2 text-sm text-ink-muted">Selamat datang, {result.member_name}</p>
            <p className="text-sm text-ink-muted">{result.branch_name}</p>
            <div className="mx-auto mt-4 max-w-[220px] rounded-[6px] bg-canvas p-3 text-sm">
              <p className="text-ink-faint">Membership</p>
              <p className="font-medium text-ink">{result.plan_name}</p>
              {result.valid_until && <p className="mt-1 text-xs text-ink-faint">Berlaku hingga {formatDate(result.valid_until)}</p>}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-ink">CHECK-IN DITOLAK</h2>
            <p className="mt-2 text-sm text-ink-muted">{result.denial_reason}</p>
            {result.denial_reason?.toLowerCase().includes("kadaluarsa") || result.denial_reason?.toLowerCase().includes("expired") ? (
              <LinkButton href="/pos" className="mt-4 inline-flex">
                Perpanjang Membership
              </LinkButton>
            ) : null}
          </>
        )}
        <Button variant="secondary" className="mt-6 w-full" onClick={() => setResult(null)}>
          Check-in Berikutnya
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md p-8">
      <p className="mb-1 text-center text-sm text-ink-faint">{branchName}</p>
      <h2 className="mb-5 text-center text-base font-semibold text-ink">Cari Member untuk Check-in</h2>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input
          autoFocus
          placeholder="Nama, telepon, atau kode member..."
          className="pl-9 py-2.5"
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          disabled={pending}
        />
      </div>
      {results.length > 0 && (
        <div className="mt-2 divide-y divide-line rounded-md border border-line">
          {results.map((m) => (
            <button
              key={m.id}
              onClick={() => handleCheckIn(m.id)}
              disabled={pending}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-canvas"
            >
              <span className="font-medium text-ink">{m.full_name}</span>
              <span className="num text-xs text-ink-faint">{m.member_code}</span>
            </button>
          ))}
        </div>
      )}
      {pending && <p className="mt-3 text-center text-sm text-ink-faint">Memvalidasi...</p>}
    </Card>
  );
}
