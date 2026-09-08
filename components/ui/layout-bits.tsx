import { cn } from "@/lib/utils";

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
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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
    <div className="border-r border-line px-5 py-4 last:border-r-0">
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

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-md border border-line bg-surface", className)}>{children}</div>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[13px] font-medium text-ink">{children}</p>;
}
