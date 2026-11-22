import { loadTrainerWorkspace } from "@/app/actions/trainer-management";
import { TrainerWorkspace } from "@/components/trainers/trainer-workspace";

export default async function TrainersPage() {
  const { scopeKey, ...workspace } = await loadTrainerWorkspace();
  return <TrainerWorkspace key={scopeKey} {...workspace} />;
}
