"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await requestPasswordReset(prev, fd);
    if (!res?.error) setSent(true);
    return res;
  }, null);

  if (sent) {
    return (
      <>
        <h1 className="text-lg font-semibold text-ink">Periksa email Anda</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Jika email tersebut terdaftar, kami telah mengirimkan tautan untuk mengatur ulang kata sandi.
        </p>
        <Link href="/login" className="mt-6 block text-sm font-medium text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-ink">Atur ulang kata sandi</h1>
      <p className="mt-1 text-sm text-ink-muted">Masukkan email akun Anda, kami akan kirimkan tautan reset.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="nama@gym.com" required autoFocus />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Mengirim..." : "Kirim tautan reset"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </>
  );
}
