"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-bits";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Select, Textarea } from "@/components/ui/field";
import { createMember } from "@/app/actions/members";

export function NewMemberForm({
  organizationId,
  gymId,
  branchId,
}: {
  organizationId: string;
  gymId: string;
  branchId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <PageHeader title="Tambah Member" description="Data dasar member baru." />
      <Card className="max-w-xl p-6">
        <form
          action={(fd) => {
            startTransition(async () => {
              const res = await createMember(fd);
              if (res.error) {
                setError(res.error);
                return;
              }
              router.push(`/members/${res.id}`);
            });
          }}
          className="space-y-4"
        >
          <input type="hidden" name="organization_id" value={organizationId} />
          <input type="hidden" name="gym_id" value={gymId} />
          <input type="hidden" name="branch_id" value={branchId} />

          <div>
            <Label htmlFor="full_name">Nama lengkap</Label>
            <Input id="full_name" name="full_name" required autoFocus placeholder="Nama member" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Telepon</Label>
              <Input id="phone" name="phone" placeholder="08xxxxxxxxxx" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="opsional" />
            </div>
          </div>
          <div>
            <Label htmlFor="gender">Jenis kelamin</Label>
            <Select id="gender" name="gender" defaultValue="">
              <option value="">Tidak disebutkan</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Opsional" />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Member"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
