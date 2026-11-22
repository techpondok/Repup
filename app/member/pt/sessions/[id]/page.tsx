import { loadMemberPt } from "@/app/actions/pt-bookings";
import { PTSessionDetail } from "@/components/member/pt/pt-session-detail";
import { LivePtSessionDetail } from "@/components/member/pt/pt-live-sessions";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [portal, { id }] = await Promise.all([loadMemberPt(), params]);
  return portal ? <LivePtSessionDetail key={id} portal={portal} id={id} /> : <PTSessionDetail id={id} />;
}
