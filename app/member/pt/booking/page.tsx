import { loadMemberPt } from "@/app/actions/pt-bookings";
import { PTBooking } from "@/components/member/pt/pt-booking";
import { LivePtBooking } from "@/components/member/pt/pt-live-booking";

export default async function Page({ searchParams }: { searchParams: Promise<{ session?: string; assignment?: string }> }) {
  const [portal, { session, assignment }] = await Promise.all([loadMemberPt(), searchParams]);
  return portal ? <LivePtBooking key={session ?? assignment ?? "new"} portal={portal} sessionId={session} assignmentId={assignment} /> : <PTBooking rescheduleId={session} />;
}
