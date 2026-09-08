"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createEquipment } from "@/app/actions/equipment";
import type { EquipmentCategory } from "@/types/database.types";

export function NewEquipmentForm({
  organizationId,
  gymId,
  branchId,
  categories,
  onSuccess,
}: {
  organizationId: string;
  gymId: string;
  branchId: string;
  categories: EquipmentCategory[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await createEquipment(fd);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
          (document.getElementById("new-equipment-form") as HTMLFormElement)?.reset();
          onSuccess?.();
          window.dispatchEvent(new Event("repup:crud-success"));
        });
      }}
      id="new-equipment-form"
      className="space-y-3"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="gym_id" value={gymId} />
      <input type="hidden" name="branch_id" value={branchId} />
      <div>
        <Label htmlFor="eq_category">Kategori</Label>
        <Select id="eq_category" name="category_id" defaultValue="">
          <option value="">Pilih kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="eq_name">Nama peralatan</Label>
        <Input id="eq_name" name="name" required placeholder="Hack Squat Machine" />
      </div>
      <div>
        <Label htmlFor="eq_brand">Merek</Label>
        <Input id="eq_brand" name="brand" placeholder="Opsional" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="eq_qty">Jumlah</Label>
          <Input id="eq_qty" name="quantity" type="number" min={1} defaultValue={1} />
        </div>
        <div>
          <Label htmlFor="eq_condition">Kondisi</Label>
          <Select id="eq_condition" name="condition" defaultValue="good">
            <option value="excellent">Sangat Baik</option>
            <option value="good">Baik</option>
            <option value="fair">Cukup</option>
            <option value="poor">Buruk</option>
          </Select>
        </div>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Tambah Peralatan"}
      </Button>
    </form>
  );
}
