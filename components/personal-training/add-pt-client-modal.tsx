"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPtClient } from "@/app/actions/personal-training";
import { CreateFormModal } from "@/components/ui/create-form-modal";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";

type Option = { id: string; name: string; price?: number; visit_limit?: number | null };

export function AddPtClientModal({ organizationId, locationId, members, coaches, plans }: { organizationId: string; locationId: string; members: Option[]; coaches: Option[]; plans: Option[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState("");
  const selectedPlan = plans.find((plan) => plan.id === planId);

  const form = <form action={(fd) => startTransition(async () => { const result = await createPtClient(fd); if (result.error) { setError(result.error); return; } router.refresh(); window.dispatchEvent(new Event("repup:crud-success")); })} className="space-y-3">
    <input type="hidden" name="organization_id" value={organizationId} /><input type="hidden" name="location_id" value={locationId} />
    <div><Label htmlFor="pt-member">Member *</Label><Select id="pt-member" name="member_id" required defaultValue=""><option value="">Pilih member existing</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></div>
    <div><Label htmlFor="pt-coach">Trainer *</Label><Select id="pt-coach" name="trainer_id" required defaultValue=""><option value="">Pilih trainer</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</Select></div>
    <div><Label htmlFor="pt-plan">PT Package *</Label><Select id="pt-plan" name="package_plan_id" required value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Pilih paket</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.price ? ` · Rp${plan.price.toLocaleString("id-ID")}` : ""}</option>)}</Select></div>
    <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="pt-start">Start Date *</Label><Input id="pt-start" name="start_date" type="date" required /></div><div><Label htmlFor="pt-end">Expiry Date</Label><Input id="pt-end" name="end_date" type="date" /></div></div>
    <div><Label htmlFor="pt-sessions">Sessions</Label><Input id="pt-sessions" name="sessions_total" type="number" min="1" required value={selectedPlan?.visit_limit ?? ""} readOnly={Boolean(selectedPlan?.visit_limit)} onChange={() => undefined} placeholder="Jumlah sesi" /></div>
    <p className="text-xs text-ink-muted">Harga paket: {selectedPlan?.price ? `Rp${selectedPlan.price.toLocaleString("id-ID")}` : "Pilih paket terlebih dahulu"}</p>
    <div><Label htmlFor="pt-goal">Training Goal</Label><Input id="pt-goal" name="goal" placeholder="Opsional" /></div><div><Label htmlFor="pt-notes">Notes</Label><Textarea id="pt-notes" name="notes" rows={2} placeholder="Opsional" /></div>
    <div><Label htmlFor="pt-reason">Alasan assignment *</Label><Input id="pt-reason" name="reason" required placeholder="Contoh: Complimentary package / migration" /></div>
    <FieldError>{error ?? undefined}</FieldError><div className="flex justify-end gap-2 pt-2"><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Add PT Client"}</Button></div>
  </form>;
  return <CreateFormModal title="Add PT Client" description="Hubungkan member existing dengan coach dan paket PT." size="medium" label="+ Add PT Client" form={form} />;
}
