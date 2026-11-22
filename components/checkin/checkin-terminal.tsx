"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, CircleOff, Clock3, Keyboard, LogIn, LogOut, Radio, Search, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/format";
import { checkInIdentifier, searchMembersForCheckIn, type CheckInResult } from "@/app/actions/checkin";

type MemberHit = { id: string; full_name: string; member_code: string; phone: string | null };
type AttendanceDirection = "IN" | "OUT" | "AUTO";
type AttendanceRow = {
  id: string; member_id?: string; occurred_at?: string | null; check_out_at?: string | null;
  attendance_status?: string | null; status?: string | null; source?: string | null; method?: string | null;
  members?: { full_name?: string | null; member_code?: string | null } | null;
};
type DemoAdapter = {
  recent: AttendanceRow[]; active: AttendanceRow[];
  search: (query: string) => Promise<MemberHit[]>;
  submit: (identifier: string, direction: AttendanceDirection) => Promise<CheckInResult>;
};

function beep(success: boolean) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = success ? 880 : 220;
  gain.gain.value = 0.045;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.onended = () => { void context.close().catch(() => {}); };
  oscillator.stop(context.currentTime + 0.12);
}

function durationSince(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}j ${minutes}m` : `${minutes}m`;
}

export function CheckinTerminal({ organizationId, branchId, branchName, initialRecent = [], initialActive = [], demo, historyUnavailable, activeUnavailable }: {
  organizationId: string; branchId: string; branchName: string; initialRecent?: AttendanceRow[]; initialActive?: AttendanceRow[];
  demo?: DemoAdapter; historyUnavailable?: boolean; activeUnavailable?: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const searchSequence = useRef(0);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const cameraRequest = useRef(0);
  const cameraStarting = useRef(false);
  const [mode, setMode] = useState<"auto" | "camera" | "manual">("auto");
  const [direction, setDirection] = useState<AttendanceDirection>("AUTO");
  const [identifier, setIdentifier] = useState("");
  const [results, setResults] = useState<MemberHit[]>([]);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [recentChanges, setRecent] = useState<AttendanceRow[]>([]);
  const [activeChanges, setActive] = useState<Record<string, AttendanceRow | null>>({});
  const recent = demo?.recent ?? [...recentChanges, ...initialRecent.filter(item => !recentChanges.some(change => change.id === item.id))].slice(0, 20);
  const active = demo?.active ?? [...Object.values(activeChanges).filter((item): item is AttendanceRow => !!item), ...initialActive.filter(item => !(item.id in activeChanges))];
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
    cameraRequest.current++;
    cameraStarting.current = false;
    scanningRef.current = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    if (cameraStarting.current || streamRef.current) return;
    const attempt = ++cameraRequest.current;
    cameraStarting.current = true;
    setMode("camera");
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStarting.current = false;
      setCameraError("Kamera tidak tersedia. Gunakan scanner USB atau input manual.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (attempt !== cameraRequest.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      setCameraOpen(true);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (attempt !== cameraRequest.current) return;
      if (!videoRef.current) throw new Error("Video unavailable");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (attempt !== cameraRequest.current) return;
      type Detector = { detect(source: HTMLVideoElement): Promise<{rawValue: string}[]> };
      const Native = (window as Window & { BarcodeDetector?: { new(options: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      let detector: Detector | undefined;
      try {
        const formats = Native?.getSupportedFormats ? await Native.getSupportedFormats() : ["qr_code", "code_128", "ean_13"];
        if (Native && formats.includes("qr_code")) detector = new Native({ formats: formats.filter(format => ["qr_code", "code_128", "ean_13"].includes(format)) });
      } catch { /* Fall back to the local QR decoder. */ }
      if (attempt !== cameraRequest.current) return;
      if (!detector) {
        const [{ BrowserQRCodeReader }, { decodePTCameraFrame }] = await Promise.all([import("@zxing/browser"), import("@/lib/pt-camera")]);
        const reader = new BrowserQRCodeReader();
        const canvas = document.createElement("canvas");
        detector = { detect: async video => [{ rawValue: decodePTCameraFrame(reader, canvas, video) }] };
      }
      if (attempt !== cameraRequest.current) return;
      cameraStarting.current = false;
      const scanner = detector;
      scanningRef.current = true;
      const scan = async () => {
        if (attempt !== cameraRequest.current || !scanningRef.current || !videoRef.current) return;
        try {
          const found = await scanner.detect(videoRef.current);
          if (attempt !== cameraRequest.current) return;
          if (found[0]?.rawValue) {
            stopCamera();
            submitIdentifier(found[0].rawValue, "camera_qr");
            return;
          }
        } catch { /* Camera frames may fail while autofocus adjusts. */ }
        if (attempt === cameraRequest.current) frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (error) {
      if (attempt !== cameraRequest.current) return;
      stopCamera();
      const name = error instanceof Error ? error.name : "";
      setCameraError(name === "NotAllowedError" ? "Izin kamera ditolak. Gunakan scanner USB atau input manual." : name === "NotFoundError" ? "Kamera tidak ditemukan. Gunakan scanner USB atau input manual." : "Scanner gagal dimulai. Coba lagi atau gunakan input manual.");
    }
  }

  function submitIdentifier(value: string, source: "manual" | "usb_qr" | "camera_qr", requestedDirection = direction) {
    const clean = value.trim();
    if (!clean || pending) return;
    setIdentifier("");
    searchSequence.current++;
    setSearching(false);
    setSearched(false);
    setResults([]);
    setFeedback("");
    startTransition(async () => {
      let response: CheckInResult;
      try {
        response = demo ? await demo.submit(clean, requestedDirection) : await checkInIdentifier(clean, branchId, source, undefined, requestedDirection);
        if (response.error) throw new Error("Attendance request failed");
      } catch {
        setFeedback("Check-in tidak dapat diproses. Coba lagi.");
        setIdentifier(clean);
        return;
      }
      stopCamera();
      setResult(response);
      try { beep(response.result_status === "success"); } catch { /* Audio is optional. */ }
      if (!demo && response.result_status === "success" && response.attendanceId) {
        const row = { id: response.attendanceId, member_id: response.memberId, occurred_at: response.checkInAt ?? new Date().toISOString(), check_out_at: response.checkOutAt, duration_seconds: response.durationSeconds, attendance_status: response.attendanceStatus, source, status: "success", members: { full_name: response.member_name, member_code: "-" }, memberships: { membership_plans: { name: response.plan_name } } };
        setRecent((items) => [row, ...items.filter((item) => item.id !== row.id)].slice(0, 20));
        if (response.action === "check_in") setActive(items => ({ ...items, [row.id]: row }));
        if (response.action === "check_out") setActive(items => ({ ...items, [row.id]: null }));
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }

  async function runSearch(value: string) {
    setIdentifier(value);
    const sequence = ++searchSequence.current;
    setFeedback("");
    setResults([]);
    setSearched(false);
    setSearching(value.trim().length >= 2);
    if (value.trim().length < 2) return;
    try {
      const hits = demo ? await demo.search(value) : await searchMembersForCheckIn(organizationId, value);
      if (sequence === searchSequence.current) { setResults(hits); setSearched(true); }
    } catch {
      if (sequence === searchSequence.current) setFeedback("Pencarian member gagal. Coba lagi.");
    } finally {
      if (sequence === searchSequence.current) setSearching(false);
    }
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
    <Card className="overflow-hidden"><div className="border-b border-line bg-surface px-4 py-4 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-primary">{branchName}</p><h2 className="mt-1 text-lg font-semibold text-ink">Check-in / Check-out</h2><p className="mt-1 text-sm text-ink-muted">Satu scan membuka atau menutup satu sesi kunjungan.</p></div><Badge tone="success"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />Terminal Ready</Badge></div><div className="mt-4 grid grid-cols-3 rounded-md bg-canvas p-1 text-xs font-medium text-ink-muted"><button type="button" onClick={() => setDirection("IN")} className={`rounded px-2 py-2 ${direction === "IN" ? "bg-surface text-primary shadow-sm" : ""}`}>CHECK-IN</button><button type="button" onClick={() => setDirection("OUT")} className={`rounded px-2 py-2 ${direction === "OUT" ? "bg-surface text-primary shadow-sm" : ""}`}>CHECK-OUT</button><button type="button" onClick={() => setDirection("AUTO")} className={`rounded px-2 py-2 ${direction === "AUTO" ? "bg-surface text-primary shadow-sm" : ""}`}>AUTO</button></div><div className="mt-3 grid grid-cols-3 rounded-md border border-line p-1 text-xs font-medium text-ink-muted"><button type="button" onClick={() => { stopCamera(); searchSequence.current++; setSearching(false); setMode("auto"); }} className={`rounded px-2 py-2 ${mode === "auto" ? "bg-canvas text-primary" : ""}`}>HID</button><button type="button" onClick={() => { searchSequence.current++; setSearching(false); void startCamera(); }} className={`rounded px-2 py-2 ${mode === "camera" ? "bg-canvas text-primary" : ""}`}>CAMERA</button><button type="button" onClick={() => { stopCamera(); setMode("manual"); inputRef.current?.focus(); }} className={`rounded px-2 py-2 ${mode === "manual" ? "bg-canvas text-primary" : ""}`}>MANUAL</button></div></div>
      <div className="p-4 sm:p-6">{mode === "camera" && <div className="mb-5 overflow-hidden rounded-lg border border-line bg-black"><div className="relative aspect-video"><video ref={videoRef} muted playsInline className="h-full w-full object-cover" />{!cameraOpen && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{cameraError ?? "Menyiapkan kamera..."}</div>}{cameraOpen && <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary" />}</div><div className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-xs text-white"><span>{cameraError ?? `Arahkan QR untuk ${direction === "OUT" ? "check-out" : "check-in"}`}</span>{cameraOpen && <button type="button" onClick={stopCamera} className="underline">Tutup kamera</button>}</div></div>}
        <div className="relative"><ScanLine size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" /><Input ref={inputRef} autoFocus value={identifier} onChange={(event) => mode === "manual" ? runSearch(event.target.value) : setIdentifier(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitIdentifier(identifier, mode === "camera" ? "camera_qr" : mode === "auto" ? "usb_qr" : "manual"); } }} disabled={pending} placeholder="Member ID / QR / RFID UID" className="h-12 pl-10 pr-4 text-base" /></div><p className="mt-2 flex items-center gap-2 text-xs text-ink-faint">{mode === "manual" ? <Search size={14} /> : <Keyboard size={14} />} {mode === "manual" ? "Cari nama, nomor telepon, atau Member ID." : `Scanner siap. Mode ${direction === "AUTO" ? "otomatis" : direction === "IN" ? "masuk" : "keluar"}. Tekan Enter setelah scan.`}</p>{cameraError && mode === "camera" && <p role="alert" className="mt-3 rounded-md bg-danger-tint px-3 py-2 text-xs text-danger">{cameraError}</p>}{feedback && <p role="alert" className="mt-3 text-sm text-danger">{feedback}</p>}{mode === "manual" && searching && <p role="status" className="mt-3 text-sm text-ink-muted">Mencari member…</p>}{mode === "manual" && searched && !results.length && <p className="mt-3 text-sm text-ink-muted">Member tidak ditemukan.</p>}{mode === "manual" && results.length > 0 && <div className="mt-2 divide-y divide-line rounded-md border border-line bg-surface">{results.map((member) => <button key={member.id} type="button" onClick={() => submitIdentifier(member.id, "manual")} disabled={pending} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-canvas"><span className="font-medium text-ink">{member.full_name}</span><span className="num text-xs text-ink-faint">{member.member_code}</span></button>)}</div>}{pending && <p role="status" className="mt-3 text-center text-sm text-ink-faint">Memproses attendance...</p>}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3"><div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted"><Camera size={15} className="text-primary" />Camera <span className="ml-auto text-success">Ready</span></div><div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted"><Keyboard size={15} className="text-primary" />USB / HID <span className="ml-auto text-success">Listening</span></div><div className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink-muted"><Radio size={15} className="text-primary" />RFID / Gate <span className="ml-auto text-ink-faint">Connector</span></div></div>
      </div></Card>
    <div className="space-y-5"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-ink">Active Visitors <span className="text-primary">{active.length}</span></h2><p className="mt-1 text-xs text-ink-muted">Member yang masih berada di gym</p></div><Clock3 size={18} className="text-primary" /></div><div className="divide-y divide-line">{activeUnavailable && <p role="alert" className="p-3 text-sm text-danger">Kunjungan aktif gagal dimuat. <button type="button" className="underline" onClick={() => router.refresh()}>Coba lagi</button></p>}{active.length === 0 && activeUnavailable ? null : active.length === 0 ? <div className="p-6 text-center text-sm text-ink-muted">Belum ada member di dalam gym.</div> : active.map((item) => <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-tint text-success"><LogIn size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.members?.full_name ?? "Member"}</p><p className="text-xs text-ink-faint">{item.members?.member_code ?? "-"} · {durationSince(item.occurred_at)}</p></div><button type="button" disabled={pending || !item.member_id} onClick={() => { if (item.member_id && window.confirm("Check-out member ini?")) submitIdentifier(item.member_id, "manual", "OUT"); }} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-medium text-ink-muted hover:border-primary hover:text-primary"><LogOut size={14} />Keluar</button></div>)}</div></Card>
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-ink">Recent Attendance</h2><p className="mt-1 text-xs text-ink-muted">Aktivitas terbaru di {branchName}</p></div><ShieldCheck size={18} className="text-primary" /></div><div className="divide-y divide-line">{historyUnavailable && <p role="alert" className="p-3 text-sm text-danger">Riwayat gagal dimuat. <button type="button" className="underline" onClick={() => router.refresh()}>Coba lagi</button></p>}{recent.length === 0 && historyUnavailable ? null : recent.length === 0 ? <div className="p-8 text-center text-sm text-ink-muted">Belum ada attendance.</div> : recent.map((item) => <div key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.status === "success" ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>{item.attendance_status === "active" ? <LogIn size={17} /> : item.check_out_at ? <LogOut size={17} /> : item.status === "success" ? <CheckCircle2 size={17} /> : <CircleOff size={17} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.members?.full_name ?? "Member"}</p><p className="truncate text-xs text-ink-faint">{item.members?.member_code ?? "-"} · {item.attendance_status ?? item.status}</p></div><div className="text-right"><p className="text-xs font-medium text-ink">{item.occurred_at && Number.isFinite(Date.parse(item.occurred_at)) ? formatDateTime(item.occurred_at) : "-"}</p><p className="mt-0.5 text-[11px] capitalize text-ink-faint">{item.source ?? item.method ?? "manual"}</p></div></div>)}</div></Card></div>
  </div>;
}
