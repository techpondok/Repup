import { notFound } from "next/navigation";
import { loadMemberPt } from "@/app/actions/pt-bookings";
import { trainers } from "@/lib/member/pt";
import { TrainerDetail } from "@/components/member/pt/trainer-detail";
import { LivePtTrainerList } from "@/components/member/pt/pt-live-trainers";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [portal, { id }] = await Promise.all([loadMemberPt(), params]);
  if (portal) return <LivePtTrainerList portal={portal} trainerId={id} />;
  const trainer = trainers.find(item => item.id === id);
  if (!trainer) notFound();
  return <TrainerDetail trainer={trainer} />;
}
