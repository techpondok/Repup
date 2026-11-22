"use client";

import { CheckinTerminal } from "./checkin-terminal";
import { useMemberDemo } from "@/components/members/demo-provider";
import { activity, current, packageFor, status } from "@/lib/demo/member-management";
import type { CheckInResult } from "@/app/actions/checkin";
import type { AttendanceDirection } from "@/lib/checkin/service";

export function DemoCheckinTerminal(props: { organizationId: string; branchId: string; branchName: string }) {
  const demo = useMemberDemo();
  const members = demo.members.filter(member => member.branchId === props.branchId);
  const rows = members.flatMap(member => member.visits.map(visit => ({
    id: visit.id, member_id: member.id, occurred_at: visit.at, check_out_at: visit.out,
    attendance_status: visit.out ? "completed" : "active", status: "success",
    members: { full_name: member.name, member_code: member.id },
  }))).sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));

  async function submit(identifier: string, direction: AttendanceDirection): Promise<CheckInResult> {
    let result: CheckInResult = { result_status: "denied", denial_reason: "Member atau QR demo tidak dikenali di cabang ini." };
    const value = identifier.replace(/^member-demo:/, "").toLowerCase();
    demo.update(items => items.map(member => {
      if (member.branchId !== props.branchId || ![member.id, member.phone].some(item => item.toLowerCase() === value)) return member;
      const visit = member.visits.find(item => !item.out);
      const membership = current(member, demo.today);
      const at = new Date().toISOString();
      const details = { member_name: member.name, plan_name: packageFor(membership?.packageId)?.name, valid_until: membership?.end };
      if (direction !== "IN" && visit) {
        result = { ...details, result_status: "success", action: "check_out", attendanceId: visit.id,
          checkInAt: visit.at, checkOutAt: at, durationSeconds: Math.max(0, Math.floor((Date.parse(at) - Date.parse(visit.at)) / 1000)) };
        return { ...member, visits: member.visits.map(item => item.id === visit.id ? { ...item, out: at } : item) };
      }
      if (direction === "OUT") {
        result = { result_status: "denied", denial_reason: "Member belum memiliki kunjungan aktif." };
        return member;
      }
      if (visit) {
        result = { ...details, result_status: "success", action: "already_inside" };
        return member;
      }
      if (!["Active", "Expiring Soon"].includes(status(member, demo.today))) {
        result = { result_status: "denied", denial_reason: "Membership member tidak aktif." };
        return member;
      }
      const id = crypto.randomUUID();
      result = { ...details, result_status: "success", action: "check_in", attendanceId: id, checkInAt: at };
      return activity({ ...member, visits: [{ id, at }, ...member.visits] }, "Check-in", "Check-in dari terminal demo", at);
    }));
    return result;
  }

  return <CheckinTerminal {...props} demo={{
    recent: rows.slice(0, 20), active: rows.filter(item => item.attendance_status === "active"),
    search: async query => members.filter(member => [member.name, member.id, member.phone]
      .some(item => item.toLowerCase().includes(query.trim().toLowerCase()))).slice(0, 8)
      .map(member => ({ id: member.id, full_name: member.name, member_code: member.id, phone: member.phone })),
    submit,
  }} />;
}
