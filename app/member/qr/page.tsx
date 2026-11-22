"use client";

import { QrCode, MapPin } from "lucide-react";
import Image from "next/image";
import { useMember } from "@/components/member/member-provider";
import { MemberQRCode } from "@/components/member/member-qr";
import { gym, branches, formatDate } from "@/lib/member/mock";

export default function MemberQRPage() {
  const { member, membership, setStatus } = useMember();
  return <div className="space-y-6">
    <header><p className="mp-muted text-sm">YOUR DIGITAL PASS</p><h1 className="mp-title">My QR</h1><p className="mp-muted mt-2">Akses gym dimulai dari sini.</p></header>
    <div className="mx-auto max-w-lg space-y-5">
      <section className="mp-card space-y-6">
        <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold"><QrCode size={19} /> {gym.name}</span><span className="mp-badge">{membership.status}</span></div>
        <div className="flex items-center gap-3 border-b border-line pb-5"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-tint font-bold text-primary">{member.avatar ? <Image unoptimized width={48} height={48} src={member.avatar} alt="" className="size-full object-cover" /> : member.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div><div className="min-w-0"><h2 className="mp-section-title break-words">{member.name}</h2><p className="mp-muted text-sm">{member.id}</p></div></div>
        <MemberQRCode eligible={membership.status === "active"} />
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm"><div><p className="mp-muted">Membership</p><p className="mt-1 font-medium">{membership.plan}</p></div><div><p className="mp-muted">Berlaku sampai</p><p className="mt-1 font-medium">{formatDate(membership.end)}</p></div></div>
        <p className="mp-muted flex items-center gap-2 text-sm"><MapPin size={15} /> Cabang {branches[0].name}</p>
      </section>
      <label className="mp-card block space-y-2 text-sm"><span className="font-medium">Simulasi status membership</span><select className="mp-field w-full" value={membership.status} onChange={event => setStatus(event.target.value as typeof membership.status)}><option value="active">Active</option><option value="expired">Expired</option><option value="frozen">Frozen</option><option value="pending">Pending</option><option value="none">Belum memiliki membership</option></select></label>
    </div>
  </div>;
}
