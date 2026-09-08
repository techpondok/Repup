"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createTrainer } from "@/app/actions/trainers";

export function NewTrainerForm({ organizationId, gymId, branchId, role = "TRAINER", onSuccess }: { organizationId: string; gymId: string; branchId: string; role?: "COACH" | "TRAINER"; onSuccess?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await createTrainer(fd);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
          (document.getElementById("new-trainer-form") as HTMLFormElement)?.reset();
          onSuccess?.();
          window.dispatchEvent(new Event("repup:crud-success"));
        });
      }}
      id="new-trainer-form"
      className="space-y-3"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="gym_id" value={gymId} />
      <input type="hidden" name="branch_id" value={branchId} />
      <input type="hidden" name="role" value={role} />
      <div>
        <Label htmlFor="t_name">Nama</Label>
        <Input id="t_name" name="full_name" required placeholder="Nama trainer" />
      </div>
      <div>
        <Label htmlFor="t_phone">Telepon</Label>
        <Input id="t_phone" name="phone" placeholder="Opsional" />
      </div>
      <div>
        <Label htmlFor="t_spec">Spesialisasi</Label>
        <Input id="t_spec" name="specialization" placeholder="Strength, Yoga, dll." />
      </div>
      <div>
        <Label htmlFor="t_type">Tipe kerja</Label>
        <Select id="t_type" name="employment_type" defaultValue="freelance">
          <option value="employee">Karyawan</option>
          <option value="freelance">Freelance</option>
        </Select>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Tambah Trainer"}
      </Button>
    </form>
  );
}
