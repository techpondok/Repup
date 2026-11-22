"use client";

import { useMemberDemo } from "@/components/members/demo-provider";
import { useStaffDemo } from "@/components/staff/demo-provider";
import { useStore } from "@/components/store/store-provider";
import { useClasses } from "@/components/member/classes/class-provider";
import { useTrainerDemo } from "@/components/trainers/trainer-demo-provider";
import { useBranchDemo } from "./demo-provider";
import { activeCount } from "@/lib/demo/member-management";
import { isPublishedClass } from "@/lib/member/classes";
import { trainerBranchIds } from "@/lib/demo/branches";

export function useBranchMetrics() {
  const member = useMemberDemo();
  const { staff } = useStaffDemo();
  const { details } = useTrainerDemo();
  const { state: store } = useStore();
  const { state: classes } = useClasses();
  const demo = useBranchDemo();
  const month = member.today.slice(0, 7);
  function forBranch(id: string) {
    const members = member.members.filter(row => row.branchId === id);
    const employees = staff.filter(row => row.branch === id);
    const trainers = details.filter(({ trainer }) => trainerBranchIds(trainer.id, trainer.branchIds).includes(id));
    const schedules = classes.schedules.filter(row => row.branchId === id && isPublishedClass(row) && row.startsAt.slice(0, 10) >= member.today);
    const sessions = details.flatMap(detail => detail.sessions.filter(row => (row.branchId ?? trainerBranchIds(detail.trainer.id, detail.trainer.branchIds)[0]) === id
      && row.date >= member.today && ["scheduled", "confirmed", "pending_approval", "upcoming"].includes(row.status)));
    const reservations = member.members.flatMap(row => (row.pt?.bookings ?? []).filter(booking => (booking.branchId ?? row.branchId) === id
      && booking.status === "Reserved" && booking.at.slice(0, 10) >= member.today).map(booking => ({ ...booking, memberName: row.name })));
    const orders = store.orders.filter(row => row.branchId === id);
    const paid = orders.filter(row => row.paidAt && new Date(row.paidAt).toISOString().startsWith(month) && row.paymentStatus === "paid");
    return { members, employees, trainers, schedules, sessions, reservations, orders, products: store.products, store,
      activeMembers: activeCount(members, member.today), checkins: member.members.flatMap(row => row.visits.map(visit => ({ visit, home: row.branchId }))).filter(({ visit, home }) => (visit.branchId ?? home) === id && visit.at.startsWith(month)).length,
      revenue: paid.reduce((sum, row) => sum + row.total - (row.refundedAmount ?? 0), 0) };
  }
  return { forBranch, rows: (demo?.active ?? []).filter(branch => demo?.scopedIds.includes(branch.id)).map(branch => ({ branch, ...forBranch(branch.id) })) };
}
