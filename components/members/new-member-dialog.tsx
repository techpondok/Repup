"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { createMember } from "@/app/actions/members";
import { Plus } from "lucide-react";

type Plan = { id: string; name: string; price: number };

export function NewMemberDialog({
  organizationId,
  gymId,
  branchId,
  plans = [],
}: {
  organizationId: string;
  gymId: string;
  branchId: string;
  plans?: Plan[];
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
    <FormModal
      open={open}
      title="Tambah Member"
      description="Daftarkan member baru dan, bila diperlukan, langsung aktifkan membership."
      size="medium"
      onClose={closeDialog}
      trigger={<Button type="button" onClick={() => setOpen(true)}><Plus size={16} /> Tambah Member</Button>}
    >
      <form
        action={(formData) => {
          startTransition(async () => {
            const result = await createMember(formData);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.push(`/members/${result.id}`);
          });
        }}
        className="space-y-5"
      >
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="gym_id" value={gymId} />
        <input type="hidden" name="branch_id" value={branchId} />

        <section className="rounded-md border border-line bg-canvas/50 p-4">
          <div className="mb-4"><h3 className="text-sm font-semibold text-ink">Data pribadi</h3><p className="mt-1 text-xs text-ink-muted">Data ini dipakai untuk identitas dan pencarian member.</p></div>
          <div className="space-y-4">
            <div><Label htmlFor="dialog-full-name">Nama lengkap <span className="text-danger">*</span></Label><Input id="dialog-full-name" name="full_name" required autoFocus placeholder="Contoh: Budi Santoso" /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label htmlFor="dialog-phone">Nomor telepon <span className="text-danger">*</span></Label><Input id="dialog-phone" name="phone" required inputMode="tel" placeholder="08xxxxxxxxxx" /></div><div><Label htmlFor="dialog-email">Email <span className="font-normal text-ink-faint">(opsional)</span></Label><Input id="dialog-email" name="email" type="email" placeholder="nama@email.com" /></div></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label htmlFor="dialog-member-code">Member ID <span className="font-normal text-ink-faint">(opsional)</span></Label><Input id="dialog-member-code" name="member_code" placeholder="Otomatis dibuat sistem" /></div><div><Label htmlFor="dialog-birth-date">Tanggal lahir <span className="font-normal text-ink-faint">(opsional)</span></Label><Input id="dialog-birth-date" name="birth_date" type="date" /></div></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label htmlFor="dialog-gender">Jenis kelamin</Label><Select id="dialog-gender" name="gender" defaultValue=""><option value="">Tidak disebutkan</option><option value="male">Laki-laki</option><option value="female">Perempuan</option></Select></div><div><Label htmlFor="dialog-emergency">Kontak darurat</Label><Input id="dialog-emergency" name="emergency_contact" placeholder="Nama · telepon" /></div></div>
          </div>
        </section>

        <section className="rounded-md border border-line bg-canvas/50 p-4">
          <div className="mb-4"><h3 className="text-sm font-semibold text-ink">Membership</h3><p className="mt-1 text-xs text-ink-muted">Pilih paket sekarang atau tambahkan membership nanti.</p></div>
          <div className="space-y-4"><div><Label htmlFor="dialog-plan">Paket membership</Label><Select id="dialog-plan" name="membership_plan_id" defaultValue=""><option value="">Belum ada paket</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · Rp{Math.round(Number(plan.price)).toLocaleString("id-ID")}</option>)}</Select></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label htmlFor="dialog-start-date">Tanggal mulai</Label><Input id="dialog-start-date" name="start_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div><div><Label htmlFor="dialog-payment-status">Status pembayaran</Label><Select id="dialog-payment-status" name="payment_status" defaultValue="unpaid"><option value="unpaid">Belum dibayar</option><option value="pending">Menunggu pembayaran</option><option value="paid">Lunas</option></Select></div></div></div>
        </section>

        <section><Label htmlFor="dialog-notes">Catatan internal <span className="font-normal text-ink-faint">(opsional)</span></Label><Textarea id="dialog-notes" name="notes" rows={3} placeholder="Contoh: preferensi jadwal, kondisi khusus, atau catatan front desk" /></section>
        <FieldError>{error ?? undefined}</FieldError>
        <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t border-line bg-surface px-6 pb-1 pt-4"><Button type="button" variant="secondary" onClick={closeDialog}>Batal</Button><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan Member"}</Button></div>
      </form>
    </FormModal>
  );
}
