import { loadMemberPt } from "@/app/actions/pt-bookings";
import DemoPtOverview from "@/components/member/pt/pt-demo-overview";
import { LivePtOverview } from "@/components/member/pt/pt-live-overview";

export default async function Page() {
  const portal = await loadMemberPt();
  return portal ? <LivePtOverview portal={portal} /> : <DemoPtOverview />;
}
