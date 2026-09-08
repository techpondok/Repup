"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createClassSession } from "@/app/actions/classes";
import type { Trainer } from "@/types/database.types";

export function NewClassForm({
  organizationId,
  gymId,
  branchId,
  trainers,
  onSuccess,
}: {
  organizationId: string;
  gymId: string;
  branchId: string;
  trainers: Trainer[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await createClassSession(fd);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
          (document.getElementById("new-class-form") as HTMLFormElement)?.reset();
          onSuccess?.();
          window.dispatchEvent(new Event("repup:crud-success"));
        });
      }}
      id="new-class-form"
      className="space-y-3"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="gym_id" value={gymId} />
      <input type="hidden" name="branch_id" value={branchId} />
      <div>
        <Label htmlFor="c_name">Nama kelas</Label>
        <Input id="c_name" name="name" required placeholder="Yoga, Zumba, HIIT..." />
      </div>
      <div>
        <Label htmlFor="c_trainer">Coach</Label>
        <Select id="c_trainer" name="trainer_id" defaultValue="">
          <option value="">Pilih coach</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="c_date">Tanggal</Label>
        <Input id="c_date" name="session_date" type="date" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c_start">Mulai</Label>
          <Input id="c_start" name="start_time" type="time" required />
        </div>
        <div>
          <Label htmlFor="c_end">Selesai</Label>
          <Input id="c_end" name="end_time" type="time" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="c_capacity">Kapasitas</Label>
          <Input id="c_capacity" name="capacity" type="number" min={1} defaultValue={20} />
        </div>
        <div>
          <Label htmlFor="c_price">Harga (Rp)</Label>
          <Input id="c_price" name="price" type="number" min={0} defaultValue={0} />
        </div>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Jadwalkan Kelas"}
      </Button>
    </form>
  );
}
