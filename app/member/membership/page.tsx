"use client";

import { useState } from "react";
import { Check, ArrowUpRight, CreditCard, MapPin, ShieldCheck } from "lucide-react";
import { FormModal } from "@/components/ui/form-modal";
import { useMember } from "@/components/member/member-provider";
import { gym, branches, payments, formatDate, plan } from "@/lib/member/mock";

export default function MemberMembershipPage() {
  const { membership, renew, notify } = useMember();
  const [dialog, setDialog] = useState<"renew" | "payments" | "contact" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [now] = useState(() => Date.now());
  const days = Math.max(0, Math.ceil((new Date(membership.end).getTime() - now) / 86400000));
  const length = Math.max(1, new Date(membership.end).getTime() - new Date(membership.start).getTime());
  const progress = Math.min(100, Math.max(0, (now - new Date(membership.start).getTime()) / length * 100));
  const close = () => { setDialog(null); setConfirmed(false); };
  return <div className="space-y-6">
    <header><p className="mp-muted text-sm">BUILT FOR YOUR PROGRESS</p><h1 className="mp-title">My membership</h1><p className="mp-muted mt-2">Satu membership. Lebih banyak kesempatan untuk bergerak.</p></header>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="mp-card space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold"><ShieldCheck size={20} /> {gym.name}</span><span className="mp-badge">{membership.status}</span></div><div><p className="mp-muted text-sm">PAKET MEMBERSHIP</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{membership.status === "none" ? "Belum ada membership" : membership.plan}</h2><p className="mp-muted mt-2">Konsistensi hari ini, progres untuk esok.</p></div>
        <div className="grid grid-cols-2 gap-5 border-y border-line py-5 text-sm"><div><p className="mp-muted">Tanggal mulai</p><p className="mt-1 font-medium">{formatDate(membership.start)}</p></div><div><p className="mp-muted">Tanggal berakhir</p><p className="mt-1 font-medium">{formatDate(membership.end)}</p></div><div><p className="mp-muted">Sisa masa aktif</p><p className="mt-1 font-medium">{membership.status === "active" ? `${days} hari` : "Tidak aktif"}</p></div><div><p className="mp-muted">Kuota kunjungan</p><p className="mt-1 font-medium">Unlimited</p></div></div>
        <div><div className="mb-2 flex justify-between gap-2 text-sm"><span>Masa membership terpakai</span><span>{Math.round(progress)}%</span></div><progress className="h-2 w-full accent-primary" value={progress} max={100} aria-label="Masa membership terpakai" /><p className="mp-muted mt-2 text-xs">{membership.status === "active" ? `${days} hari tersisa untuk terus membangun progres.` : "Membership belum bisa digunakan untuk check-in."}</p></div>
        <button className="mp-button" onClick={() => setDialog("renew")}>Renew membership <ArrowUpRight size={17} /></button>
      </section>
      <div className="space-y-6"><section className="mp-card"><h2 className="mp-section-title">Semua yang kamu butuhkan</h2><ul className="mt-5 space-y-4 text-sm">{plan.benefits.map(benefit => <li className="flex gap-3" key={benefit}><Check size={17} className="shrink-0 text-primary" />{benefit}</li>)}</ul></section><section className="mp-card"><h2 className="mp-section-title">Cabang yang dapat diakses</h2><ul className="mt-4 space-y-3 text-sm">{branches.map(branch => <li key={branch.id} className="flex items-center gap-2"><MapPin size={16} className="text-primary" />{branch.name}</li>)}</ul></section></div>
    </div>
    <section className="mp-card"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="mp-section-title">Riwayat membership</h2><button className="mp-button secondary" onClick={() => setDialog("payments")}><CreditCard size={16} /> Riwayat pembayaran</button></div><div className="mt-5 space-y-4">{payments.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><div><p className="font-medium">{payment.plan}</p><p className="mp-muted mt-1 text-sm">Pembelian {formatDate(payment.date)} · Periode 30 hari</p></div><span className="mp-badge">Selesai</span></div>)}</div></section>
    <div className="mp-card flex flex-wrap items-center justify-between gap-4"><div><h2 className="mp-section-title">Butuh bantuan membership?</h2><p className="mp-muted mt-1 text-sm">Tim gym siap membantumu memilih langkah berikutnya.</p></div><button className="mp-button secondary" onClick={() => setDialog("contact")}>Contact gym <ArrowUpRight size={16} /></button></div>
    <FormModal open={dialog !== null} title={dialog === "renew" ? "Renew membership" : dialog === "payments" ? "Riwayat pembayaran" : "Hubungi gym"} trigger={null} onClose={close}>
      {dialog === "renew" && <div className="space-y-5"><p className="mp-muted">{confirmed ? "Membership demo berhasil diperpanjang. Tidak ada transaksi atau tagihan sungguhan." : "Perpanjang paket selama 30 hari. Ini hanya simulasi tanpa pembayaran sungguhan."}</p><div className="rounded-xl border border-line p-4"><p className="font-semibold">{plan.name}</p><p className="mt-2 text-2xl font-semibold">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(plan.price)} <span className="mp-muted text-sm font-normal">/ 30 hari</span></p></div><button className="mp-button" onClick={() => { if (confirmed) { close(); return; } renew(); setConfirmed(true); notify("Membership demo diperpanjang. Tidak ada pembayaran sungguhan."); }}>{confirmed ? "Selesai" : "Konfirmasi perpanjangan demo"}</button></div>}
      {dialog === "payments" && <div className="space-y-4"><p className="mp-muted text-sm">Seluruh pembayaran berikut adalah data contoh.</p>{payments.map(payment => <div key={payment.id} className="flex flex-wrap justify-between gap-3 border-b border-line pb-4"><div><p className="font-medium">{payment.plan}</p><p className="mp-muted text-sm">{formatDate(payment.date)} · {payment.id}</p></div><div className="text-right"><p>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(payment.amount)}</p><span className="mp-muted text-sm">{payment.status}</span></div></div>)}</div>}
      {dialog === "contact" && <div className="space-y-4"><p className="font-medium">{gym.name} · Member Support</p><p className="mp-muted">Hubungi resepsionis cabang utama untuk bantuan membership, jadwal, dan fasilitas. Dalam demo ini pesan disimpan sebagai simulasi.</p><form className="space-y-4" onSubmit={event => { event.preventDefault(); notify("Pesan demo diterima. Tidak ada pesan yang dikirim ke gym."); close(); }}><label className="block space-y-2 text-sm"><span>Pesan</span><textarea className="mp-field w-full" required minLength={10} maxLength={1000} rows={4} placeholder="Ceritakan kebutuhanmu..." /></label><button className="mp-button" type="submit">Kirim pesan demo</button></form></div>}
    </FormModal>
  </div>;
}


