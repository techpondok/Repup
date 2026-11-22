import { loadMemberPt } from "@/app/actions/pt-bookings";
import DemoPtSessions from "@/components/member/pt/pt-demo-sessions";
import { LivePtSessions } from "@/components/member/pt/pt-live-sessions";

export default async function Page() {
  const portal = await loadMemberPt();
  return portal ? <LivePtSessions portal={portal} /> : <DemoPtSessions />;
}
