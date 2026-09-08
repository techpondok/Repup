"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createBranch } from "@/app/actions/branches";

export function NewBranchForm({ organizationId, gymId, onSuccess }: { organizationId: string; gymId: string; onSuccess?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await createBranch(fd);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
          (document.getElementById("new-branch-form") as HTMLFormElement)?.reset();
          onSuccess?.();
          window.dispatchEvent(new Event("repup:crud-success"));
        });
      }}
      id="new-branch-form"
      className="space-y-3"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="gym_id" value={gymId} />
      <div>
        <Label htmlFor="b_name">Nama cabang</Label>
        <Input id="b_name" name="name" required placeholder="PowerFit Surabaya" />
      </div>
      <div>
        <Label htmlFor="b_address">Alamat</Label>
        <Input id="b_address" name="address" placeholder="Opsional" />
      </div>
      <div>
        <Label htmlFor="b_phone">Telepon</Label>
        <Input id="b_phone" name="phone" placeholder="Opsional" />
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Tambah Cabang"}
      </Button>
    </form>
  );
}
