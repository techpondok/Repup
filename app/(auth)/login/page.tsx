"use client";

import { useActionState } from "react";
import { useState } from "react";
import Link from "next/link";
import { signIn, signInDemo, type ActionState } from "@/app/actions/auth";
import { DEMO_BUSINESS_ROLES, DEMO_ROLES } from "@/lib/demo/roles";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signIn, null);
  const [showDemo, setShowDemo] = useState(false);

  return (
    <>
      <h1 className="auth-title">Masuk ke RepUp</h1>
      <p className="auth-subtitle">Kelola bisnis olahraga & wellness Anda dari satu tempat.</p>

      <form action={formAction} className="auth-form">
        <div>
          <Label htmlFor="email" className="auth-label">Email</Label>
          <Input id="email" name="email" type="email" placeholder="nama@bisnis.com" required autoFocus className="auth-input" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="auth-label">Kata sandi</Label>
            <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-primary hover:underline">
              Lupa kata sandi?
            </Link>
          </div>
          <Input id="password" name="password" type="password" placeholder="••••••••" required className="auth-input" />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="auth-submit" disabled={pending}>
          {pending ? "Memproses..." : "Masuk"}
        </Button>
      </form>

      <div className="auth-divider"><span /> atau <span /></div>
      <button type="button" className="auth-demo-trigger text-center" onClick={() => setShowDemo(true)}>
        Coba live demo
      </button>

      {showDemo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="demo-login-title">
        <div className="w-full max-w-2xl border border-line bg-[#111310] p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">RepUp Business</p><h2 id="demo-login-title" className="mt-2 text-2xl font-semibold text-ink">Pilih peran demo</h2><p className="mt-1 text-sm text-ink-muted">Masuk langsung tanpa email atau password.</p></div><button type="button" onClick={() => setShowDemo(false)} className="text-xl text-ink-muted hover:text-ink" aria-label="Tutup">×</button></div>
          <div className="grid gap-2 sm:grid-cols-2">{DEMO_BUSINESS_ROLES.map((role) => <form key={role} action={async (formData) => { await signInDemo(null, formData); }}><input type="hidden" name="role" value={role} /><button type="submit" className="w-full border border-line-strong p-3 text-left transition-colors hover:border-primary hover:bg-primary-tint"><span className="block text-xs font-bold uppercase tracking-widest text-primary">{role}</span><span className="mt-1 block text-sm font-medium text-ink">{DEMO_ROLES[role].name}</span><span className="mt-1 block text-xs text-ink-muted">{DEMO_ROLES[role].access}</span></button></form>)}</div>
          <div className="mt-5 border-t border-line pt-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-faint">RepUp Platform</p><form action={async (formData) => { await signInDemo(null, formData); }}><input type="hidden" name="role" value="SUPER_ADMIN" /><button type="submit" className="w-full border border-line-strong p-3 text-left transition-colors hover:border-primary hover:bg-primary-tint"><span className="block text-xs font-bold uppercase tracking-widest text-primary">SUPER ADMIN</span><span className="mt-1 block text-sm font-medium text-ink">{DEMO_ROLES.SUPER_ADMIN.name}</span><span className="mt-1 block text-xs text-ink-muted">{DEMO_ROLES.SUPER_ADMIN.access}</span></button></form></div>
          <Link href="/demo" className="mt-5 block text-center text-xs font-medium text-primary hover:underline">Lihat halaman demo lengkap</Link>
        </div>
      </div>}

      <p className="auth-signup">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Daftarkan bisnis
        </Link>
      </p>
    </>
  );
}
