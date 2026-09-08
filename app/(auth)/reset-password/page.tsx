"use client";

import { useActionState } from "react";
import { updatePassword, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updatePassword, null);

  return (
    <>
      <h1 className="text-lg font-semibold text-ink">Buat kata sandi baru</h1>
      <p className="mt-1 text-sm text-ink-muted">Gunakan kata sandi yang kuat dan belum pernah dipakai sebelumnya.</p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">Kata sandi baru</Label>
          <Input id="password" name="password" type="password" placeholder="Minimal 8 karakter" required autoFocus />
        </div>
        <FieldError>{state?.error}</FieldError>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan kata sandi"}
        </Button>
      </form>
    </>
  );
}
