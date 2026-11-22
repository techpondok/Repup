"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, CircleOff, Clock3, Keyboard, LogIn, LogOut, Radio, Search, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { checkInIdentifier, searchMembersForCheckIn, type CheckInResult } from "@/app/actions/checkin";

type MemberHit = { id: string; full_name: string; member_code: string; phone: string | null };
type AttendanceDirection = "IN" | "OUT" | "AUTO";
type AttendanceRow = any;

function beep(success: boolean) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = success ? 880 : 220;
  gain.gain.value = 0.045;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}

function durationSince(value?: string | null) {
  if (!value) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}j ${minutes}m` : `${minutes}m`;
}

export function CheckinTerminal({ organizationId, branchId, branchName, initialRecent = [], initialActive = [] }: { organizationId: string; branchId: string; branchName: string; initialRecent?: AttendanceRow[]; initialActive?: AttendanceRow[] }) {
  const [mode, setMode] = useState<"auto" | "camera" | "manual">("auto");
  const [direction, setDirection] = useState<AttendanceDirection>("AUTO");
  const [identifier, setIdentifier] = useState("");
  const [results, setResults] = useState<MemberHit[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [recent, setRecent] = useState<AttendanceRow[]>(initialRecent);
  const [active, setActive] = useState<AttendanceRow[]>(initialActive);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scanningRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  function stopCamera() {
    scanningRef.current = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    setMode("camera");
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera tidak tersedia. Gunakan scanner USB atau input manual.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setCameraError("Browser belum mendukung scan QR otomatis. Gunakan scanner USB atau input manual.");
        return;
      }
      const detector = new Detector({ formats: ["qr_code", "code_128", "ean_13"] });
      scanningRef.current = true;
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found[0]?.rawValue) {
            stopCamera();
            submitIdentifier(found[0].rawValue, "camera_qr");
            return;
          }
        } catch { /* Camera frames may fail while autofocus adjusts. */ }
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (error: any) {
      setCameraError(error?.name === "NotAllowedError" ? "Kamera tidak diizinkan. Gunakan scanner USB atau input manual." : "Kamera gagal dibuka.");
    }
  }

  function submitIdentifier(value: string, source: "manual" | "usb_qr" | "camera_qr", requestedDirection = direction) {
    const clean = value.trim();
    if (!clean || pending) return;
    setIdentifier("");
    setResults([]);
    startTransition(async () => {
      const response = await checkInIdentifier(clean, branchId, source, undefined, requestedDirection);
      setResult(response);
      beep(response.result_status === "success");
      if (response.result_status === "success" && response.attendanceId) {
        const row = { id: response.attendanceId, member_id: clean, occurred_at: response.checkInAt ?? new Date().toISOString(), check_out_at: response.checkOutAt, duration_seconds: response.durationSeconds, attendance_status: response.attendanceStatus, source, status: "success", members: { full_name: response.member_name, member_code: "-" }, memberships: { membership_plans: { name: response.plan_name } } };
        setRecent((items) => [row, ...items.filter((item) => item.id !== row.id)].slice(0, 20));
        if (response.action === "check_in") setActive((items) => [row, ...items.filter((item) => item.id !== row.id)]);
        if (response.action === "check_out") setActive((items) => items.filter((item) => item.id !== response.attendanceId));
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }

  async function runSearch(value: string) {
    setIdentifier(value);
    if (value.trim().length < 2) return setResults([]);
    setResults((await searchMembersForCheckIn(organizationId, value)) as MemberHit[]);
  }

  function resetResult() {
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (result) {
    const success = result.result_status === "success";
    const checkedOut = result.action === "check_out";
    const alreadyInside = result.action === "already_inside";
    return <div className="space-y-5"><Card className={`mx-auto max-w-xl border-2 p-6 text-center sm:p-10 ${success ? "border-success/30" : "border-danger/30"}`}><div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${success ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>{success ? <CheckCircle2 size={32} /> : <XCircle size={32} />}</div><h2 className="text-xl font-semibold text-ink">{!success ? "ACCESS DENIED" : checkedOut ? "CHECK-OUT BERHASIL" : alreadyInside ? "MEMBER SUDAH DI DALAM" : "CHECK-IN BERHASIL"}</h2><p className="mt-2 text-sm text-ink-muted">{success ? `${result.member_name ?? "Member"}${checkedOut ? " telah keluar dari gym." : ""}` : result.denial_reason}</p>{success && <div className="mx-auto mt-5 max-w-sm rounded-md bg-canvas p-4 text-left text-sm"><div className="flex justify-between gap-3"><span className="text-ink-faint">Membership</span><span className="font-medium text-ink">{result.plan_name ?? "-"}</span></div><div className="mt-2 flex justify-between gap-3"><span className="text-ink-faint">Status kunjungan</span><span className="font-medium text-ink">{checkedOut ? "Selesai" : alreadyInside ? "Masih di gym" : "Sedang di gym"}</span></div>{result.durationSeconds != null && <div className="mt-2 flex justify-between gap-3"><span className="text-ink-faint">Durasi</span><span className="text-ink">{Math.floor(result.durationSeconds / 60)} menit</span></div>}{result.valid_until && <div className="mt-2 flex justify-between gap-3"><span className="text-ink-faint">Berlaku hingga</span><span className="text-ink">{formatDate(result.valid_until)}</span></div>}</div>}{!success && result.denial_reason?.toLowerCase().includes("kadaluarsa") ? <LinkButton href="/pos" className="mt-4 inline-flex">Perpanjang Membership</LinkButton> : null}<Button variant="secondary" className="mt-6 w-full" onClick={resetResult}>Scan Berikutnya</Button></Card></div>;
  }

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
    <Card className="overflow-hidden"><div className="border-b border-line bg-surface px-4 py-4 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">{branchName}</p><h2 className="mt-1 text-lg font-semibold text-ink">Check-in / Check-out</h2><p className="mt-1 text-sm text-ink-muted">Satu scan membuka atau menutup satu sesi kunjungan.</p></div><Badge tone="success"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />Terminal Ready</Badge></div><div className="mt-4 grid grid-cols-3 rounded-md bg-canvas p-1 text-xs font-medium text-ink-muted"><button type="button" onClick={() => setDirection("IN")} className={`rounded px-2 py-2 ${direction === "IN" ? "bg-surface text-primary shadow-sm" : ""}`}>CHECK-IN</button><button type="button" onClick={() => setDirection("OUT")} className={`rounded px-2 py-2 ${direction === "OUT" ? "bg-surface text-primary shadow-sm" : ""}`}>CHECK-OUT</button><button type="button" onClick={() => setDirection("AUTO")} className={`rounded px-2 py-2 ${direction === "AUTO" ? "bg-surface text-primary shadow-sm" : ""}`}>AUTO</button></div><div className="mt-3 grid grid-cols-3 rounded-md border border-line p-1 text-xs font-medium text-ink-muted"><button type="button" onClick={() => setMode("auto")} className={`rounded px-2 py-2 ${mode === "auto" ? "bg-canvas text-primary" : ""}`}>HID</button><button type="button" onClick={startCamera} className={`rounded px-2 py-2 ${mode === "camera" ? "bg-canvas text-primary" : ""}`}>CAMERA</button><button type="button" onClick={() => { stopCamera(); setMode("manual"); inputRef.current?.focus(); }} className={`rounded px-2 py-2 ${mode === "manual" ? "bg-canvas text-primary" : ""}`}>MANUAL</button></div></div>
      <div className="p-4 sm:p-6">{mode === "camera" && <div className="mb-5 overflow-hidden rounded-lg border border-line bg-black"><div className="relative aspect-video"><video ref={videoRef} muted playsInline className="h-full w-full object-cover" />{!cameraOpen && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{cameraError ?? "Menyiapkan kamera..."}</div>}{cameraOpen && <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary" />}</div><div className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-xs text-white"><span>{cameraError ?? `Arahkan QR untuk ${direction === "OUT" ? "check-out" : "check-in"}`}</span>{cameraOpen && <button type="button" onClick={stopCamera} className="underline">Tutup kamera</button>}</div></div>}
        <div className="relative"><ScanLine size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" /><Input ref={inputRef} autoFocus value={identifier} onChange={(event) => mode === "manual" ? runSearch(event.target.value) : setIdentifier(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitIdentifier(identifier, mode === "camera" ? "camera_qr" : mode === "auto" ? "usb_qr" : "manual"); } }} disabled={pending} placeholder="Member ID / QR / RFID UID" className="h-12 pl-10 pr-4 text-base" /></div><p className="mt-2 flex items-center gap-2 text-xs text-ink-faint">{mode === "manual" ? <Search size={14} /> : <Keyboard size={14} />} {mode === "manual" ? "Cari nama, nomor telepon, atau Member ID." : `Scanner siap. Mode ${direction === "AUTO" ? "otomatis" : direction === "IN" ? "masuk" : "keluar"}. Tekan Enter setelah scan.`}</p>{cameraError && mode === "camera" && <p className="mt-3 rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">{cameraError}</p>}{results.length > 0 && <div className="mt-2 divide-y divide-line rounded-md border border-line bg-surface">{results.map((member) => <button key={member.id} type="button" onClick={() => submitIdentifier(member.id, "manual")} disabled={pending} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-canvas"><span className="font-medium text-ink">{member.full_name}</span><span className="num text-xs text-ink-faint">{member.member_code}</span></button>)}</div>}{pending && <p className="mt-3 text-center text-sm text-ink-faint">Memproses attendance...</p>}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3"><div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted"><Camera size={15} className="text-primary" />Camera <span className="ml-auto text-success">Ready</span></div><div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted"><Keyboard size={15} className="text-primary" />USB / HID <span className="ml-auto text-success">Listening</span></div><div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted"><Radio size={15} className="text-primary" />RFID / Gate <span className="ml-auto text-ink-faint">Connector</span></div></div>
      </div></Card>
    <div className="space-y-5"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-ink">Active Visitors <span className="text-primary">{active.length}</span></h2><p className="mt-1 text-xs text-ink-muted">Member yang masih berada di gym</p></div><Clock3 size={18} className="text-primary" /></div><div className="divide-y divide-line">{active.length === 0 ? <div className="p-6 text-center text-sm text-ink-muted">Belum ada member di dalam gym.</div> : active.map((item: any) => <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-tint text-success"><LogIn size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.members?.full_name ?? "Member"}</p><p className="text-xs text-ink-faint">{item.members?.member_code ?? "-"} · {durationSince(item.occurred_at)}</p></div><button type="button" disabled={pending} onClick={() => { if (window.confirm("Check-out member ini?")) submitIdentifier(item.member_id, "manual", "OUT"); }} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-medium text-ink-muted hover:border-primary hover:text-primary"><LogOut size={14} />Keluar</button></div>)}</div></Card>
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-ink">Recent Attendance</h2><p className="mt-1 text-xs text-ink-muted">Aktivitas terbaru di {branchName}</p></div><ShieldCheck size={18} className="text-primary" /></div><div className="divide-y divide-line">{recent.length === 0 ? <div className="p-8 text-center text-sm text-ink-muted">Belum ada attendance.</div> : recent.map((item: any) => <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.status === "success" ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>{item.attendance_status === "active" ? <LogIn size={17} /> : item.check_out_at ? <LogOut size={17} /> : item.status === "success" ? <CheckCircle2 size={17} /> : <CircleOff size={17} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.members?.full_name ?? "Member"}</p><p className="truncate text-xs text-ink-faint">{item.members?.member_code ?? "-"} · {item.attendance_status ?? item.status}</p></div><div className="text-right"><p className="text-xs font-medium text-ink">{formatDateTime(item.occurred_at)}</p><p className="mt-0.5 text-[11px] capitalize text-ink-faint">{item.source ?? item.method ?? "manual"}</p></div></div>)}</div></Card></div>
  </div>;
}
