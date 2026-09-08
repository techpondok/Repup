"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Select, Textarea } from "@/components/ui/field";
import { createMember } from "@/app/actions/members";
import { Plus, X } from "lucide-react";

export function NewMemberDialog({
  organizationId,
  gymId,
  branchId,
}: {
  organizationId: string;
  gymId: string;
  branchId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function closeDialog() {
    if (!pending) {
      setError(null);
      setOpen(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Tambah Member
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
          <div className="w-full max-w-xl rounded-lg border border-line bg-surface shadow-xl" role="dialog" aria-modal="true" aria-labelledby="new-member-title">
            <div className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <h2 id="new-member-title" className="text-lg font-semibold text-ink">Tambah Member</h2>
                <p className="mt-1 text-sm text-ink-muted">Data dasar member baru.</p>
              </div>
              <button type="button" onClick={closeDialog} className="rounded p-1 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Tutup dialog">
                <X size={18} />
              </button>
            </div>

            <form action={(formData) => {
              startTransition(async () => {
                const result = await createMember(formData);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                router.push(`/members/${result.id}`);
              });
            }} className="max-h-[calc(100vh-10rem)] space-y-4 overflow-y-auto p-6">
              <input type="hidden" name="organization_id" value={organizationId} />
              <input type="hidden" name="gym_id" value={gymId} />
              <input type="hidden" name="branch_id" value={branchId} />
              <div><Label htmlFor="dialog-full-name">Nama lengkap</Label><Input id="dialog-full-name" name="full_name" required autoFocus placeholder="Nama member" /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="dialog-phone">Telepon</Label><Input id="dialog-phone" name="phone" placeholder="08xxxxxxxxxx" /></div><div><Label htmlFor="dialog-email">Email</Label><Input id="dialog-email" name="email" type="email" placeholder="opsional" /></div></div>
              <div><Label htmlFor="dialog-gender">Jenis kelamin</Label><Select id="dialog-gender" name="gender" defaultValue=""><option value="">Tidak disebutkan</option><option value="male">Laki-laki</option><option value="female">Perempuan</option></Select></div>
              <div><Label htmlFor="dialog-notes">Catatan</Label><Textarea id="dialog-notes" name="notes" rows={3} placeholder="Opsional" /></div>
              <FieldError>{error ?? undefined}</FieldError>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={closeDialog}>Batal</Button><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Member"}</Button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}