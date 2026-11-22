"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePairingCode } from "@/app/actions/members";
import { formatDateTime } from "@/lib/format";

export function PairingCodeButton({ memberId, compact = false }: { memberId: string; compact?: boolean }) {
  const [result, setResult] = useState<{ code?: string; expiresAt?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  function generate() { startTransition(async () => setResult(await generatePairingCode(memberId))); }
  async function copy() { if (result?.code) await navigator.clipboard.writeText(result.code); }

  return (
    <div className="flex items-center gap-2">
      {!result?.code && <Button type="button" variant="secondary" size="sm" onClick={generate} disabled={pending}><KeyRound size={14} /> {pending ? "Membuat..." : compact ? "Pairing" : "Generate Pairing Code"}</Button>}
      {result?.code && <div className="flex items-center gap-2 rounded-[6px] border border-primary/30 bg-primary-tint px-2 py-1.5"><span className="num font-semibold tracking-[0.2em] text-primary">{result.code}</span><button type="button" onClick={copy} className="text-primary" title="Salin kode"><Copy size={14} /></button><button type="button" onClick={generate} className="text-xs text-ink-muted underline">Regenerate</button></div>}
      {result?.expiresAt && <span className="text-[11px] text-ink-faint">sampai {formatDateTime(result.expiresAt)}</span>}
      {result?.error && <span className="text-xs text-danger">{result.error}</span>}
    </div>
  );
}
