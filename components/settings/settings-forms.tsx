"use client";

import { useState, useTransition } from "react";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateGymSettings, updateOrganizationSettings } from "@/app/actions/settings";
import type { Gym, Organization } from "@/types/database.types";

export function OrganizationSettingsForm({ organization }: { organization: Organization }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await updateOrganizationSettings(fd);
          setSaved(!res.error);
          setError(res.error ?? null);
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="organization_id" value={organization.id} />
      <div>
        <Label htmlFor="o_name">Nama organisasi</Label>
        <Input id="o_name" name="name" defaultValue={organization.name} required />
      </div>
      <div>
        <Label htmlFor="o_legal">Nama badan usaha</Label>
        <Input id="o_legal" name="legal_name" defaultValue={organization.legal_name ?? ""} />
      </div>
      <div>
        <Label htmlFor="o_billing">Email penagihan</Label>
        <Input id="o_billing" name="billing_email" type="email" defaultValue={organization.billing_email ?? ""} />
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      {saved && <p className="text-xs text-success">Tersimpan.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>
    </form>
  );
}

export function GymSettingsForm({ gym }: { gym: Gym }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await updateGymSettings(fd);
          setSaved(!res.error);
          setError(res.error ?? null);
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="gym_id" value={gym.id} />
      <div>
        <Label htmlFor="g_name">Nama gym</Label>
        <Input id="g_name" name="name" defaultValue={gym.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="g_phone">Telepon</Label>
          <Input id="g_phone" name="contact_phone" defaultValue={gym.contact_phone ?? ""} />
        </div>
        <div>
          <Label htmlFor="g_email">Email</Label>
          <Input id="g_email" name="contact_email" type="email" defaultValue={gym.contact_email ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="g_address">Alamat</Label>
        <Input id="g_address" name="address" defaultValue={gym.address ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="g_currency">Mata uang</Label>
          <Select id="g_currency" name="currency" defaultValue={gym.currency}>
            <option value="IDR">IDR — Rupiah</option>
            <option value="USD">USD — US Dollar</option>
            <option value="MYR">MYR — Ringgit</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="g_timezone">Zona waktu</Label>
          <Select id="g_timezone" name="timezone" defaultValue={gym.timezone}>
            <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
            <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
            <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
          </Select>
        </div>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      {saved && <p className="text-xs text-success">Tersimpan.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Perubahan"}
      </Button>
    </form>
  );
}
