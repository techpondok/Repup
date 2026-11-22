import { Card, LoadingSkeleton, PageHeader } from "@/components/ui/layout-bits";

export default function LoadingTrainers() {
  return <div role="status" className="space-y-4">
    <PageHeader title="Trainer Management" description="Manage your personal trainers, availability, and schedules." />
    <span className="sr-only">Loading trainers…</span>
    <div className="grid gap-3 sm:grid-cols-3">
      {["Total Trainers", "Active Trainers", "On Leave"].map(label => <Card key={label} className="space-y-2 p-4">
        <p className="text-sm text-ink-muted">{label}</p><LoadingSkeleton className="h-7 w-14" />
      </Card>)}
    </div>
    <Card className="space-y-4 p-4"><LoadingSkeleton className="h-9 w-full" /><LoadingSkeleton className="h-12 w-full" /><LoadingSkeleton className="h-12 w-full" /></Card>
  </div>;
}
