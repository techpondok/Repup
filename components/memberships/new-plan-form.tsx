"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-bits";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Select, Textarea } from "@/components/ui/field";
import { createPlan } from "@/app/actions/memberships";
import type { Branch } from "@/types/database.types";

export function NewPlanForm({
  organizationId,
  gymId,
  branches,
}: {
  organizationId: string;
  gymId: string;
  branches: Branch[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [branchAccess, setBranchAccess] = useState("all");

  return (
    <div>
      <PageHeader title="Buat Paket Membership" description="Tentukan harga, durasi, dan akses cabang untuk paket ini." />
      <Card className="max-w-xl p-6">
        <form
          action={(fd) => {
            startTransition(async () => {
              const res = await createPlan(fd);
              if (res.error) {
                setError(res.error);
                return;
              }
              router.push("/memberships");
            });
          }}
          className="space-y-4"
        >
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="gym_id" value={gymId} />

          <div>
            <Label htmlFor="name">Nama paket</Label>
            <Input id="name" name="name" required placeholder="Monthly" autoFocus />
          </div>
          <div>
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea id="description" name="description" rows={2} placeholder="Opsional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price">Harga (Rp)</Label>
              <Input id="price" name="price" type="number" min={0} required defaultValue={300000} />
            </div>
            <div>
              <Label htmlFor="visit_limit">Batas kunjungan</Label>
              <Input id="visit_limit" name="visit_limit" type="number" min={0} placeholder="Tanpa batas" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="duration_value">Durasi</Label>
              <Input id="duration_value" name="duration_value" type="number" min={1} defaultValue={1} required />
            </div>
            <div>
              <Label htmlFor="duration_unit">Satuan</Label>
              <Select id="duration_unit" name="duration_unit" defaultValue="month">
                <option value="day">Hari</option>
                <option value="month">Bulan</option>
                <option value="year">Tahun</option>
                <option value="visit">Kunjungan</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="branch_access">Akses cabang</Label>
            <Select
              id="branch_access"
              name="branch_access"
              value={branchAccess}
              onChange={(e) => setBranchAccess(e.target.value)}
            >
              <option value="all">Semua Cabang Organisasi</option>
              <option value="selected">Cabang Terpilih</option>
              <option value="single">1 Cabang</option>
            </Select>
          </div>
          {branchAccess === "selected" && (
            <div className="rounded-[6px] border border-line-strong p-3">
              <p className="mb-2 text-xs text-ink-faint">Pilih cabang yang termasuk</p>
              <div className="space-y-1.5">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="branch_ids" value={b.id} />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Paket"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
