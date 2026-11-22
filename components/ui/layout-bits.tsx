import { cn } from "@/lib/utils";
import { Activity, Inbox } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line-strong px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink-muted"><Inbox size={22} aria-hidden="true" /></span>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  delta,
  deltaTone = "neutral",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="stat-cell border-r border-line px-5 py-4 last:border-r-0">
      <p className="text-xs text-ink-faint">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="num text-2xl font-semibold text-ink">{value}</span>
        {delta && (
          <span
            className={cn(
              "text-xs font-medium",
              deltaTone === "up" && "text-success",
              deltaTone === "down" && "text-danger",
              deltaTone === "neutral" && "text-ink-faint"
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function Card({ id, className, children, statGroup = false }: { id?: string; className?: string; children: React.ReactNode; statGroup?: boolean }) {
  return <div id={id} className={cn("app-card rounded-xl border border-line bg-surface", className, statGroup && "stat-group")}>{children}</div>;
}

export function StatCard({ label, value, detail, icon, trend }: { label: string; value: string; detail?: string; icon?: React.ReactNode; trend?: string }) {
  return <Card className="p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm text-ink-muted">{label}</p><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-ink-muted">{icon ?? <Activity size={18} />}</span></div><p className="num mt-4 break-words text-[clamp(1.5rem,2.3vw,2rem)] font-semibold leading-tight text-ink">{value}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">{trend && <span className="text-success">{trend}</span>}{detail}</div></Card>;
}

export function AnalyticsCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <Card><div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 className="text-ink">{title}</h2>{description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}</div>{action}</div><div className="min-w-0 p-5">{children}</div></Card>;
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("app-skeleton h-5 rounded-md bg-elevated", className)} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[13px] font-medium text-ink">{children}</p>;
}
