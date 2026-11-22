import { loadMemberPt } from "@/app/actions/pt-bookings";
import DemoPtTrainers from "@/components/member/pt/pt-demo-trainers";
import { LivePtTrainerList } from "@/components/member/pt/pt-live-trainers";

export default async function Page() {
  const portal = await loadMemberPt();
  return portal ? <LivePtTrainerList portal={portal} /> : <DemoPtTrainers />;
}
