"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { inviteStaff } from "@/app/actions/branches";

export function InviteStaffForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await inviteStaff(fd);
          if (res.error) {
            setError(res.error);
            return;
          }
          router.refresh();
          (document.getElementById("invite-staff-form") as HTMLFormElement)?.reset();
        });
      }}
      id="invite-staff-form"
      className="space-y-3"
    >
      <input type="hidden" name="organization_id" value={organizationId} />
      <div>
        <Label htmlFor="s_email">Email</Label>
        <Input id="s_email" name="email" type="email" required placeholder="staff@email.com" />
      </div>
      <div>
        <Label htmlFor="s_role">Role</Label>
        <Select id="s_role" name="role" defaultValue="staff">
          <option value="admin">Admin</option>
          <option value="manager">Branch Manager</option>
          <option value="cashier">Cashier</option>
          <option value="trainer">Trainer</option>
          <option value="staff">Staff</option>
        </Select>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Mengundang..." : "Kirim Undangan"}
      </Button>
    </form>
  );
}
