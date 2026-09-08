import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-muted",
  success: "bg-success-tint text-success",
  warning: "bg-amber-tint text-amber",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
  primary: "bg-primary-tint text-primary",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", toneClass[tone], className)}>
      {children}
    </span>
  );
}

const MEMBER_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  expiring_soon: "warning",
  expired: "danger",
  suspended: "danger",
  visitor: "info",
  archived: "neutral",
};

const MEMBER_STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  expiring_soon: "Segera Berakhir",
  expired: "Kadaluarsa",
  suspended: "Ditangguhkan",
  visitor: "Pengunjung",
  archived: "Diarsipkan",
};

export function MemberStatusBadge({ status }: { status: string }) {
  return <Badge tone={MEMBER_STATUS_TONE[status] ?? "neutral"}>{MEMBER_STATUS_LABEL[status] ?? status}</Badge>;
}

const TXN_STATUS_TONE: Record<string, Tone> = {
  pending: "warning",
  paid: "success",
  cancelled: "danger",
  refunded: "neutral",
};
const TXN_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  paid: "Lunas",
  cancelled: "Dibatalkan",
  refunded: "Dikembalikan",
};

export function TransactionStatusBadge({ status }: { status: string }) {
  return <Badge tone={TXN_STATUS_TONE[status] ?? "neutral"}>{TXN_STATUS_LABEL[status] ?? status}</Badge>;
}

const MEMBERSHIP_STATUS_TONE: Record<string, Tone> = {
  pending: "info",
  active: "success",
  expiring_soon: "warning",
  expired: "danger",
  frozen: "info",
  cancelled: "neutral",
};
const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  active: "Aktif",
  expiring_soon: "Segera Berakhir",
  expired: "Kadaluarsa",
  frozen: "Dibekukan",
  cancelled: "Dibatalkan",
};

export function MembershipStatusBadge({ status }: { status: string }) {
  return <Badge tone={MEMBERSHIP_STATUS_TONE[status] ?? "neutral"}>{MEMBERSHIP_STATUS_LABEL[status] ?? status}</Badge>;
}
