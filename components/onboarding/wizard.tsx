"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { createBusiness, createFirstMembershipPlan, finishOnboarding } from "@/app/actions/onboarding";

const STEPS = ["Bisnis", "Gym", "Cabang", "Membership", "Selesai"] as const;

export function OnboardingWizard({
  existingOrganizationId,
  existingGymId,
}: {
  existingOrganizationId: string | null;
  existingGymId: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [orgName, setOrgName] = useState("");
  const [gymName, setGymName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");

  const [organizationId, setOrganizationId] = useState<string | null>(existingOrganizationId);
  const [gymId, setGymId] = useState<string | null>(existingGymId);

  const [planName, setPlanName] = useState("Monthly");
  const [planPrice, setPlanPrice] = useState("300000");
  const [planDuration, setPlanDuration] = useState("1");
  const [planUnit, setPlanUnit] = useState("month");

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleCreateBusiness() {
    if (!orgName.trim() || !gymName.trim() || !branchName.trim()) {
      setError("Mohon lengkapi semua kolom yang wajib diisi.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("org_name", orgName);
      fd.set("gym_name", gymName);
      fd.set("branch_name", branchName);
      fd.set("branch_address", branchAddress);
      fd.set("branch_phone", branchPhone);
      const res = await createBusiness(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setOrganizationId(res.data.organization_id);
      setGymId(res.data.gym_id);
      next();
    });
  }

  function handleCreatePlan() {
    if (!organizationId || !gymId) {
      setError("Data gym tidak ditemukan, silakan ulangi.");
      return;
    }
    if (!planName.trim() || !planPrice) {
      setError("Nama dan harga paket wajib diisi.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("organization_id", organizationId);
      fd.set("gym_id", gymId);
      fd.set("name", planName);
      fd.set("price", planPrice);
      fd.set("duration_value", planDuration);
      fd.set("duration_unit", planUnit);
      const res = await createFirstMembershipPlan(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      next();
    });
  }

  function handleFinish() {
    if (!organizationId) return;
    startTransition(async () => {
      await finishOnboarding(organizationId);
      router.push("/dashboard");
    });
  }

  return (
    <div className="rounded-md border border-line bg-surface p-7">
      <ol className="mb-8 flex items-center justify-between">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                  i < step ? "bg-primary text-primary-foreground" : i === step ? "border-2 border-primary text-primary" : "border border-line-strong text-ink-faint"
                )}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={cn("text-[11px]", i <= step ? "text-ink" : "text-ink-faint")}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 h-px flex-1", i < step ? "bg-primary" : "bg-line")} />
            )}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Tentang bisnis Anda</h2>
            <p className="mt-1 text-sm text-ink-muted">Nama organisasi yang menaungi gym Anda.</p>
          </div>
          <div>
            <Label htmlFor="org_name">Nama organisasi / bisnis</Label>
            <Input id="org_name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="PT Power Fitness Indonesia" autoFocus />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <Button className="w-full" onClick={next} disabled={!orgName.trim()}>
            Lanjutkan
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Nama gym Anda</h2>
            <p className="mt-1 text-sm text-ink-muted">Ini adalah brand gym yang akan dilihat oleh member Anda.</p>
          </div>
          <div>
            <Label htmlFor="gym_name">Nama gym</Label>
            <Input id="gym_name" value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="PowerFit" autoFocus />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>
              Kembali
            </Button>
            <Button className="flex-1" onClick={next} disabled={!gymName.trim()}>
              Lanjutkan
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Cabang pertama Anda</h2>
            <p className="mt-1 text-sm text-ink-muted">Anda dapat menambahkan cabang lain kapan saja setelah ini.</p>
          </div>
          <div>
            <Label htmlFor="branch_name">Nama cabang</Label>
            <Input id="branch_name" value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="PowerFit Kediri" autoFocus />
          </div>
          <div>
            <Label htmlFor="branch_address">Alamat</Label>
            <Input id="branch_address" value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} placeholder="Jl. Dhoho No. 1, Kediri" />
          </div>
          <div>
            <Label htmlFor="branch_phone">Nomor telepon</Label>
            <Input id="branch_phone" value={branchPhone} onChange={(e) => setBranchPhone(e.target.value)} placeholder="0354xxxxxxx" />
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Kembali
            </Button>
            <Button className="flex-1" onClick={handleCreateBusiness} disabled={pending || !branchName.trim()}>
              {pending ? "Menyimpan..." : "Buat organisasi"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Buat paket membership pertama</h2>
            <p className="mt-1 text-sm text-ink-muted">Anda bisa menambahkan lebih banyak paket nanti dari halaman Membership.</p>
          </div>
          <div>
            <Label htmlFor="plan_name">Nama paket</Label>
            <Input id="plan_name" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Monthly" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="plan_price">Harga (Rp)</Label>
              <Input id="plan_price" type="number" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="plan_duration">Durasi</Label>
              <div className="flex gap-2">
                <Input id="plan_duration" type="number" min={1} value={planDuration} onChange={(e) => setPlanDuration(e.target.value)} className="w-16" />
                <Select value={planUnit} onChange={(e) => setPlanUnit(e.target.value)}>
                  <option value="day">Hari</option>
                  <option value="month">Bulan</option>
                  <option value="year">Tahun</option>
                  <option value="visit">Kunjungan</option>
                </Select>
              </div>
            </div>
          </div>
          <FieldError>{error ?? undefined}</FieldError>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={next}>
              Lewati
            </Button>
            <Button className="flex-1" onClick={handleCreatePlan} disabled={pending}>
              {pending ? "Menyimpan..." : "Buat paket"}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-tint text-success">
            <Check size={22} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">Gym Anda siap digunakan</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {gymName} sudah dikonfigurasi. Anda dapat mulai menambahkan member dan memproses transaksi.
            </p>
          </div>
          <Button className="w-full" onClick={handleFinish} disabled={pending}>
            {pending ? "Membuka dashboard..." : "Buka Dashboard"}
          </Button>
        </div>
      )}
    </div>
  );
}
