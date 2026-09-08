"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signUp, null);

  return (
    <>
      <h1 className="text-lg font-semibold text-ink">Daftarkan gym Anda</h1>
      <p className="mt-1 text-sm text-ink-muted">Mulai kelola member dan operasional gym dalam hitungan menit.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="full_name">Nama lengkap</Label>
          <Input id="full_name" name="full_name" placeholder="Nama Anda" required autoFocus />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="nama@gym.com" required />
        </div>
        <div>
          <Label htmlFor="phone">Nomor telepon</Label>
          <Input id="phone" name="phone" placeholder="08xxxxxxxxxx" />
        </div>
        <div>
          <Label htmlFor="password">Kata sandi</Label>
          <Input id="password" name="password" type="password" placeholder="Minimal 8 karakter" required />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Membuat akun..." : "Buat akun"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Masuk
        </Link>
      </p>
    </>
  );
}
