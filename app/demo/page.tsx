import Link from "next/link";
import { signInDemo } from "@/app/actions/auth";
import { DEMO_BUSINESS_ROLES, DEMO_ROLES, type DemoRole } from "@/lib/demo/roles";

async function enterDemo(formData: FormData) {
  "use server";
  await signInDemo(null, formData);
}

const roleDetails: Record<DemoRole, { title: string; description: string; scope?: string }> = {
  OWNER: { title: "Pemilik Bisnis", description: "Akses penuh untuk melihat operasional, member, transaksi, laporan, staff, dan pengaturan." },
  ADMIN: { title: "Administrator", description: "Mengelola operasional bisnis, member, membership, kelas, trainer, dan laporan." },
  MANAGER: { title: "Manager Cabang", description: "Mengelola operasional cabang yang ditugaskan.", scope: "Demo scope: Surabaya" },
  RECEPTIONIST: { title: "Front Desk", description: "Member, membership, booking, check-in, renewal, dan komunikasi." },
  CASHIER: { title: "Kasir", description: "POS, transaksi, pembayaran, invoice, dan aktivitas kasir." },
  STAFF: { title: "Karyawan", description: "Akses operasional dasar sesuai permission." },
  COACH: { title: "Trainer", description: "Kelas, jadwal, client, program latihan, dan attendance." },
  TRAINER: { title: "Trainer", description: "Kelas, jadwal, client, program latihan, dan attendance." },
  MEMBER: { title: "Member", description: "Lihat jadwal kelas dan progress latihan Anda." },
  SUPER_ADMIN: { title: "Super Admin", description: "Platform demo." }, SUPPORT: { title: "Support", description: "Platform demo." }, SALES: { title: "Sales", description: "Platform demo." }, FINANCE: { title: "Finance", description: "Platform demo." },
};

function RoleCard({ role }: { role: DemoRole }) {
  const config = DEMO_ROLES[role];
  const detail = roleDetails[role];
  return <form action={enterDemo} className={`demo-role-card${role === "OWNER" ? " recommended" : ""}`}><div>{role === "OWNER" && <span className="demo-recommended">Recommended</span>}<span className="demo-role-scope">{role}</span><h2>{detail.title}</h2><p>{detail.description}</p>{detail.scope && <small>{detail.scope}</small>}</div><input type="hidden" name="role" value={role} /><button type="submit">Masuk sebagai {config.name} <span>↗</span></button></form>;
}

export default function DemoPage() {
  return <main className="demo-picker"><header className="demo-picker-header"><Link href="/" className="brand">REP<span>UP</span><i>.</i></Link><span className="demo-badge">DEMO MODE · LOCAL MOCK DATA</span><Link href="/login" className="demo-back">Kembali ke login</Link></header><section className="demo-picker-intro"><p className="demo-kicker">REPUP BUSINESS · COBA LIVE DEMO</p><h1>PILIH<br/><em>PERAN.</em></h1><p>Pilih peran untuk melihat bagaimana RepUp bekerja untuk setiap bagian bisnis gym. Tidak perlu email, password, OTP, atau registrasi.</p></section><section className="demo-role-section"><div className="demo-section-title"><span>01</span><h2>REPUP BUSINESS</h2><p>Satu aplikasi bisnis dengan permission dan data scope yang berbeda.</p></div><div className="demo-role-grid">{DEMO_BUSINESS_ROLES.map((role) => <RoleCard key={role} role={role} />)}</div></section><footer><span>Yudha Demo · PowerHouse Fitness · Sample data lokal</span><Link href="/register">Mulai RepUp →</Link></footer></main>;
}
