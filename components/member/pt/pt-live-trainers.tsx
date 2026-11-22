import Link from "next/link";
import type { PtPortal } from "@/lib/pt-bookings";
import { EmptyState } from "./pt-ui";
import { LivePtError, LivePtHeader, PtAssignmentTrainer } from "./pt-live-shared";

export function LivePtTrainerList({ portal, trainerId }: { portal: PtPortal; trainerId?: string }) {
  const linked = portal.assignments.filter(item => item.trainerId && (!trainerId || item.trainerId === trainerId));
  return <div className="space-y-6">
    <LivePtHeader title="Assigned Trainers" description="Review the trainers assigned to your PT packages." />
    {portal.error ? <LivePtError message={portal.error} /> : linked.length ? <div className="grid gap-4 lg:grid-cols-2">
      {linked.map(item => <section className="mp-card space-y-3" key={item.id}><PtAssignmentTrainer assignment={item} /><p className="mp-muted text-sm">{item.packageName}</p></section>)}
    </div> : <EmptyState title="No trainer assignment available" description="Your gym assigns a trainer to each PT package.">
      <Link className="mp-button secondary" href="/member/pt">My Personal Training</Link>
    </EmptyState>}
  </div>;
}
