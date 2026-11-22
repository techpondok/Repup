"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { demoQRDataURL } from "@/lib/member/qr";
import { RefreshCw, ShieldCheck, AlertCircle } from "lucide-react";

type QRState = "active" | "expired" | "invalid";

export function MemberQRCode({ eligible }: { eligible: boolean }) {
  const [state, setState] = useState<QRState>("active");
  const [remaining, setRemaining] = useState(30);
  const [generation, setGeneration] = useState(0);
  const [image, setImage] = useState("");
  const [error, setError] = useState(false);
  const refresh = () => { setImage(""); setError(false); setState("active"); setRemaining(30); setGeneration(value => value + 1); };

  useEffect(() => {
    if (!eligible || state !== "active") return;
    let cancelled = false;
    Promise.resolve().then(() => demoQRDataURL(`repup-demo-only:${crypto.randomUUID()}`))
      .then(result => { if (!cancelled) { setImage(result); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [eligible, state, generation]);

  useEffect(() => {
    if (!eligible || state !== "active") return;
    let left = 30;
    const timer = window.setInterval(() => {
      left -= 1;
      setRemaining(left || 30);
      if (left === 0) { setImage(""); setGeneration(value => value + 1); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [eligible, state, generation]);

  const unavailable = !eligible || state !== "active" || error;
  return <div className="space-y-5 text-center">
    <div className="mx-auto flex aspect-square w-full max-w-72 items-center justify-center rounded-2xl bg-white p-3 text-[#111511]" aria-busy={!image && !unavailable}>
      {unavailable ? <div className="space-y-3 p-5"><AlertCircle className="mx-auto" size={36} /><p className="font-semibold">{!eligible ? "Membership tidak aktif" : error ? "QR gagal dibuat" : state === "expired" ? "QR sudah kedaluwarsa" : "QR tidak valid"}</p><p className="text-sm">{!eligible ? "Aktifkan membership untuk menampilkan QR." : "Refresh untuk membuat QR demo baru."}</p></div> : image ? <Image unoptimized src={image} alt="QR check-in demo; tidak berlaku untuk check-in sungguhan" width={288} height={288} className="w-full" /> : <div role="status" className="animate-pulse text-sm">Menyiapkan QR…</div>}
    </div>
    <div className="flex items-center justify-center gap-2 text-sm"><ShieldCheck size={16} /><span>{unavailable ? "QR tidak tersedia" : !image ? "Menyiapkan QR…" : `QR aktif · diperbarui dalam ${remaining} detik`}</span></div>
    <p className="mp-muted text-sm">Show this QR code at the gym reception</p>
    <button className="mp-button mx-auto" onClick={refresh} disabled={!eligible}><RefreshCw size={16} /> Refresh QR</button>
    <p className="mp-muted text-xs">Mode demo. QR ini bukan bukti autentikasi atau check-in yang valid.</p>
    <div className="flex flex-wrap justify-center gap-2 border-t border-line pt-4"><button className="mp-button secondary" disabled={!eligible} onClick={() => { setState("expired"); setImage(""); }}>Simulasi expired</button><button className="mp-button secondary" disabled={!eligible} onClick={() => { setState("invalid"); setImage(""); }}>Simulasi invalid</button></div>
  </div>;
}
