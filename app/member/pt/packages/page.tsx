import { loadMemberPt } from "@/app/actions/pt-bookings";
import DemoPtPackages from "@/components/member/pt/pt-demo-packages";
import { LivePtOverview } from "@/components/member/pt/pt-live-overview";

export default async function Page() {
  const portal = await loadMemberPt();
  return portal ? <LivePtOverview portal={portal} packages /> : <DemoPtPackages />;
}
