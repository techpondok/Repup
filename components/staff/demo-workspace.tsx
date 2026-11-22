"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateFormModal } from "@/components/ui/create-form-modal";
import { DataTable } from "@/components/ui/data-table";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { employmentTypes, staffRoles, type DemoStaff } from "@/lib/demo/staff";
import { useStaffDemo } from "./demo-provider";
import { useBranchDemo } from "@/components/branches/demo-provider";

type Branch = { id: string; name: string };
const employmentLabels = { full_time: "Penuh waktu", part_time: "Paruh waktu", freelance: "Freelance" };

function NewStaffForm({ branches, onSuccess }: { branches: Branch[]; onSuccess: () => void }) {
  const { createStaff } = useStaffDemo();
  const [error, setError] = useState<string>();

  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const branch = String(values.get("branch"));
    const failure = !branches.some(item => item.id === branch) ? "Pilih cabang yang tersedia." : createStaff({
      name: String(values.get("name")), email: String(values.get("email")), branch,
      position: values.get("position") as DemoStaff["position"], employment: values.get("employment") as DemoStaff["employment"],
    });
    if (failure) { setError(failure); return; }
    onSuccess();
    window.dispatchEvent(new Event("repup:crud-success"));
  }}>
    <div><Label htmlFor="demo-staff-name">Nama lengkap</Label><Input id="demo-staff-name" name="name" required maxLength={100} /></div>
    <div><Label htmlFor="demo-staff-email">Email fiktif</Label><Input id="demo-staff-email" name="email" type="email" maxLength={254} required placeholder="staff@example.test" /></div>
    <div><Label htmlFor="demo-staff-role">Role</Label><Select id="demo-staff-role" name="position">{staffRoles.map(role => <option key={role}>{role}</option>)}</Select></div>
    <div><Label htmlFor="demo-staff-employment">Tipe kerja</Label><Select id="demo-staff-employment" name="employment">{employmentTypes.map(type => <option key={type} value={type}>{employmentLabels[type]}</option>)}</Select></div>
    <div><Label htmlFor="demo-staff-branch">Cabang</Label><Select id="demo-staff-branch" name="branch" required>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></div>
    <FieldError>{error}</FieldError>
    <Button type="submit">Simpan Staff</Button>
  </form>;
}

export function DemoStaffWorkspace({ branches: initialBranches, canCreate, branchId }: { branches: Branch[]; canCreate: boolean; branchId?: string }) {
  const { staff } = useStaffDemo();
  const scope = useBranchDemo();
  const allowed = scope?.allowed ?? initialBranches;
  const branches = branchId ? allowed.filter(branch => branch.id === branchId) : scope?.scope ? [scope.scope] : allowed;
  const active = scope ? branches.filter(branch => scope.active.some(item => item.id === branch.id)) : branches;
  const [message, setMessage] = useState("");
  const visible = staff.filter(row => branches.some(branch => branch.id === row.branch));
  return <div className="space-y-4">
    <PageHeader title="Staff" description="Kelola staff dan akses cabang mereka." actions={canCreate && active.length > 0 &&
      <CreateFormModal title="Tambah Staff" description="Tambahkan profil fiktif untuk demo. Profil ini juga tersedia di Payroll." label="Tambah Staff" size="small" form={<NewStaffForm branches={active} onSuccess={() => setMessage("Staff berhasil ditambahkan.")} />} />} />
    {message && <p role="status" className="rounded-md bg-primary-tint p-3 text-sm text-primary">{message}</p>}
    <Card>{visible.length ? <DataTable className="w-full min-w-[620px] text-sm">
      <thead><tr className="border-b border-line text-left text-xs text-ink-faint">{["Nama", "Role", "Cabang", "Tipe kerja", "Status"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{visible.map(row => <tr key={row.id} className="border-b border-line last:border-0">
        <td className="px-4 py-3"><p className="font-medium text-ink">{row.name}</p><p className="text-xs text-ink-muted">{row.code} · {row.email}</p></td>
        <td className="px-4 py-3">{row.position}</td><td className="px-4 py-3">{branches.find(branch => branch.id === row.branch)?.name}</td>
        <td className="px-4 py-3">{employmentLabels[row.employment]}</td><td className="px-4 py-3"><Badge tone="success">Aktif</Badge></td>
      </tr>)}</tbody>
    </DataTable> : <EmptyState title="Belum ada staff di cabang ini" />}</Card>
  </div>;
}
