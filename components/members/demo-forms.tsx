"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { TrainerDrawer as Drawer } from "@/components/trainers/trainer-drawer";
import { formatCurrency } from "@/lib/format";
import { activity, addDays, blankProfile, current, followStatuses, newMember, packageFor, packages, payments, phoneKey, profileError, type FollowUp, type Member, type Membership, type Profile } from "@/lib/demo/member-management";
import { useMemberDemo } from "./demo-provider";
import { useBranchDemo } from "@/components/branches/demo-provider";
import { Avatar, dateLabel, Facts } from "./demo-ui";

export type Save = (message: string) => void;
type Common = { close: () => void; saved: Save; limit: () => void };
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <Label>{label}<span className="mt-1 block">{children}</span></Label>;
}
export function Footer({ close, label = "Save", disabled = false }: { close: () => void; label?: string; disabled?: boolean }) {
  return <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
    <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
    <Button type="submit" disabled={disabled}>{label}</Button>
  </div>;
}
export const newId = () => `RPU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const makeMembership = (packageId: string, start: string, end: string, price: number, method: string): Membership =>
  ({ id: crypto.randomUUID(), packageId, start, end, price, method, frozen: false });

export function MemberForm({ member, branchId, close, saved, limit }: Common & { member?: Member; branchId: string }) {
  const demo = useMemberDemo();
  const scope = useBranchDemo();
  const activeBranches = scope?.active.filter(branch => scope.scopedIds.includes(branch.id)) ?? [];
  const [id] = useState(() => member?.id ?? newId());
  const [packageId, setPackage] = useState("");
  const [start, setStart] = useState(demo.today);
  const [customEnd, setEnd] = useState("");
  const [photo, setPhoto] = useState(member?.photo ?? "");
  const [photoPending, setPhotoPending] = useState(false);
  const [error, setError] = useState("");
  const plan = packageFor(packageId);
  const end = customEnd || (plan && start ? addDays(start, plan.days - 1) : "");
  const profile = member ?? blankProfile;
  const canAssignMembership = !member?.memberships.length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const home = member?.branchId ?? (value(data, "homeBranch") || branchId);
    if (scope && !member && !activeBranches.some(branch => branch.id === home)) return setError("Select an active home branch.");
    const availableExtras = scope?.owner ? scope.active : [];
    const extra = data.getAll("allowedBranches").map(String).filter(id => availableExtras.some(branch => branch.id === id));
    const allowedBranchIds = scope?.owner ? [...new Set([home, ...extra, ...(member?.allowedBranchIds ?? []).filter(id => !availableExtras.some(branch => branch.id === id))])] : member?.allowedBranchIds;
    const next: Profile = { name: value(data, "name"), phone: value(data, "phone"), email: value(data, "email"), birth: value(data, "birth"), gender: value(data, "gender"), address: value(data, "address"), emergency: value(data, "emergency"), photo };
    const invalid = profileError(next);
    if (invalid) return setError(invalid);
    if (demo.members.some(item => item.id !== id && phoneKey(item.phone) === phoneKey(next.phone))) return setError("This phone number is already registered.");
    if (plan && (!start || !end || end < start)) return setError("Expiration must be on or after the start date.");
    const membership = canAssignMembership && plan
      ? makeMembership(plan.id, start, end, plan.price, value(data, "method"))
      : undefined;
    const result = demo.update(items => {
      if (!member) return [...items, { ...newMember(next, id, home, demo.today, membership), allowedBranchIds }];
      return items.map(item => {
        if (item.id !== id) return item;
        const updated = activity({ ...item, ...next, allowedBranchIds }, "Member Updated", "Profile information updated");
        if (!membership || !plan || item.memberships.length) return updated;
        return activity({ ...updated, memberships: [membership] }, "Membership Purchased", plan.name);
      });
    });
    if (result === "limit") return limit();
    saved(member
      ? membership ? "Member profile updated and membership assigned." : "Member profile updated."
      : "Member added to this demo session.");
  }

  return <Drawer title={member ? "Edit Member" : "Add Member"} onClose={close}>
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full Name"><Input name="name" defaultValue={profile.name} required maxLength={100} /></Field>
        <Field label="Member ID"><Input value={id} readOnly /></Field>
        {!!activeBranches.length && !member && <Field label="Home Branch"><Select name="homeBranch" defaultValue={branchId}>{activeBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</Select></Field>}
        <Field label="Phone Number"><Input name="phone" type="tel" defaultValue={profile.phone} required /></Field>
        <Field label="Email"><Input name="email" type="email" defaultValue={profile.email} /></Field>
        <Field label="Date of Birth"><Input name="birth" type="date" defaultValue={profile.birth} max={demo.today} /></Field>
        <Field label="Gender"><Select name="gender" defaultValue={profile.gender}><option value="">Select gender</option>{["Female", "Male", "Other", "Prefer not to say"].map(item => <option key={item}>{item}</option>)}</Select></Field>
        <Field label="Address"><Textarea name="address" defaultValue={profile.address} rows={2} /></Field>
        <Field label="Emergency Contact"><Input name="emergency" defaultValue={profile.emergency} placeholder="Name and phone number" /></Field>
        <div>
          <Field label="Profile Photo"><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoPending} onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            event.target.value = "";
            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) {
              return setError("Choose a JPG, PNG or WebP image under 2 MB.");
            }
            setPhotoPending(true);
            setError("");
            const reader = new FileReader();
            reader.onload = () => { setPhoto(String(reader.result)); setPhotoPending(false); };
            reader.onerror = () => { setError("Could not read the photo."); setPhotoPending(false); };
            reader.readAsDataURL(file);
          }} /></Field>
          {photo && <div className="mt-2 flex items-center gap-2">
            <Avatar name={profile.name} photo={photo} />
            <Button type="button" size="sm" variant="ghost" onClick={() => setPhoto("")}>Remove photo</Button>
          </div>}
        </div>
      </div>
      {scope?.owner && <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-medium">Additional allowed branches</legend>{scope.active.map(branch =>
        <label key={branch.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="allowedBranches" value={branch.id} defaultChecked={member?.allowedBranchIds?.includes(branch.id)} />{branch.name}</label>)}</fieldset>}
      {canAssignMembership && <fieldset className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
        <legend className="text-sm font-medium">Membership (optional)</legend>
        <Field label="Package"><Select value={packageId} onChange={e => { setPackage(e.target.value); setEnd(""); }}>
          <option value="">No Membership</option>{packages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select></Field>
        {plan && <>
          <Field label="Start Date"><Input type="date" required value={start} onChange={e => { setStart(e.target.value); setEnd(""); }} /></Field>
          <Field label="Expiration Date"><Input type="date" required value={end} min={start} onChange={e => setEnd(e.target.value)} /></Field>
          <Field label="Payment Method"><Select name="method" required>{payments.map(item => <option key={item}>{item}</option>)}</Select></Field>
        </>}
      </fieldset>}
      <div role="alert"><FieldError>{error}</FieldError></div>
      <Footer close={close} disabled={photoPending} />
    </form>
  </Drawer>;
}

export function RenewalForm({ member, changePackage, close, saved, limit }: Common & { member: Member; changePackage?: boolean }) {
  const demo = useMemberDemo();
  const existing = current(member, demo.today);
  const choices = packages.filter(plan => !changePackage || plan.id !== existing?.packageId);
  const [packageId, setPackage] = useState(changePackage ? choices[0].id : existing?.packageId ?? choices[0].id);
  const [start, setStart] = useState(demo.today);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState(payments[0]);
  const [confirming, setConfirming] = useState(false);
  const plan = packageFor(packageId)!;
  const carriedDays = !changePackage && existing && existing.start <= start && existing.end >= start
    ? Math.max(0, Math.round((Date.parse(existing.end) - Date.parse(start)) / 86400000) + 1)
    : 0;
  const expiration = start ? addDays(start, plan.days + carriedDays - 1) : "";
  const title = changePackage ? "Change Package" : "Renew Membership";
  const total = plan.price - discount;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirming) return setConfirming(true);
    const membership = makeMembership(packageId, start, expiration, total, method);
    const result = demo.update(items => items.map(item => {
      if (item.id !== member.id) return item;
      const history = item.memberships.map(entry => entry.end >= start && (!entry.supersededOn || entry.supersededOn > start)
        ? { ...entry, supersededOn: start }
        : entry);
      const renewed = activity({ ...item, memberships: [membership, ...history] }, changePackage ? "Membership Package Changed" : existing ? "Membership Renewed" : "Membership Purchased", `${plan.name} · ends ${dateLabel(expiration)}`);
      if (changePackage || !item.followUps.length) return renewed;
      return { ...renewed, followUps: [{ ...item.followUps[0], status: "Renewed", date: demo.today, notes: "Membership renewed in demo.", next: "" }, ...item.followUps] };
    }));
    if (result === "limit") return limit();
    saved(changePackage ? "Membership package updated." : "Membership renewed in this demo session.");
  }

  return <Drawer title={confirming ? `Confirm ${title.toLowerCase()}` : title} onClose={close}>
    <form className="space-y-5" onSubmit={submit}>
      <Facts values={[
        ["Current Membership", packageFor(existing?.packageId)?.name ?? "No Membership"],
        ["Duration", `${plan.days} days`], ["New Expiration Date", dateLabel(expiration)],
        ["Price", formatCurrency(plan.price)], ["Total After Discount", formatCurrency(total)],
      ]} />
      {confirming ? <>
        <p className="text-sm">Apply {plan.name} to {member.name} starting {dateLabel(start)}. {carriedDays > 0 ? `${carriedDays} remaining days will carry over. ` : ""} Record {formatCurrency(total)} as paid by {method} in this demo.</p>
        <Footer close={() => setConfirming(false)} label="Confirm & Save" />
      </> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New Package"><Select value={packageId} onChange={event => { setPackage(event.target.value); setDiscount(0); }}>{choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
          <Field label="Start Date"><Input type="date" min={demo.today} value={start} onChange={event => setStart(event.target.value)} required /></Field>
          <Field label="Discount (IDR)"><Input type="number" min="0" max={plan.price} value={discount} onChange={event => setDiscount(Number(event.target.value))} required /></Field>
          <Field label="Payment Method"><Select value={method} onChange={event => setMethod(event.target.value)}>{payments.map(item => <option key={item}>{item}</option>)}</Select></Field>
        </div>
        <Footer close={close} label="Review Membership" />
      </>}
    </form>
  </Drawer>;
}

export function FollowUpForm({ member, staff, close, saved }: { member: Member; staff: string; close: () => void; saved: Save }) {
  const demo = useMemberDemo();
  const [date, setDate] = useState(demo.today);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record: FollowUp = { staff: value(data, "staff"), method: value(data, "method"), date, notes: value(data, "notes"), next: value(data, "next"), status: value(data, "status") };
    if (!record.staff || !record.notes) return setError("Enter assigned staff and notes.");
    demo.update(items => items.map(item => item.id === member.id ? activity({ ...item, followUps: [record, ...item.followUps] }, "Follow-up Added", `${record.status} · ${record.method} · ${record.notes}`) : item));
    saved("Follow-up recorded.");
  }

  return <Drawer title="Add Follow-up" onClose={close} centered>
    <form className="space-y-4" onSubmit={submit}>
      <Field label="Member"><Input value={member.name} readOnly /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Assigned Staff"><Input name="staff" defaultValue={staff} required /></Field>
        <Field label="Contact Method"><Select name="method">{["WhatsApp", "Phone", "Email", "In person"].map(method => <option key={method}>{method}</option>)}</Select></Field>
        <Field label="Follow-up Date"><Input type="date" value={date} onChange={event => setDate(event.target.value)} max={demo.today} required /></Field>
        <Field label="Next Follow-up Date"><Input name="next" type="date" min={date} /></Field>
      </div>
      <Field label="Follow-up Status"><Select name="status" defaultValue={member.followUps[0]?.status ?? "Contacted"}>{followStatuses.map(status => <option key={status}>{status}</option>)}</Select></Field>
      <Field label="Notes"><Textarea name="notes" rows={3} maxLength={800} required /></Field>
      <div role="alert"><FieldError>{error}</FieldError></div>
      <Footer close={close} />
    </form>
  </Drawer>;
}
