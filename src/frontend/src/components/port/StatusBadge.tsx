import { cn } from "@/lib/utils";
import type { CongestionLevel, VesselStatus } from "@/lib/port/types";

const tone = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/35",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted text-muted-foreground border-border",
} as const;

export function Pill({
  children,
  variant = "muted",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LevelBadge({ level }: { level: CongestionLevel }) {
  const variant =
    level === "critical" || level === "high" ? "danger" : level === "medium" ? "warning" : "success";
  return <Pill variant={variant}>{level.toUpperCase()}</Pill>;
}


export function VesselStatusBadge({ status }: { status: VesselStatus }) {
  const variant = status === "Waiting" ? "danger" : status === "Docked" ? "success" : "info";
  return <Pill variant={variant}>{status}</Pill>;
}
