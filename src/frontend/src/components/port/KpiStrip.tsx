import { Activity, Anchor, Clock, Cog, Gauge, Ship, TrendingDown, TrendingUp, Warehouse } from "lucide-react";
import type { CongestionResult, KeyMetrics, PortSummary } from "@/lib/port/types";
import { LevelBadge } from "./StatusBadge";

function TrendArrow({ current, previous, lowerIsBetter = true }: { current: number; previous: number; lowerIsBetter?: boolean }) {
  if (current === previous) return <span className="text-muted-foreground text-xs">—</span>;
  const improved = lowerIsBetter ? current < previous : current > previous;
  return improved
    ? <TrendingDown className="size-3.5 text-success" aria-label="Improved" />
    : <TrendingUp className="size-3.5 text-destructive" aria-label="Worsened" />;
}

// Single KPI strip — one row a judge can read in ten seconds.
export function KpiStrip({
  summary,
  congestion,
  metrics,
  previousCongestion,
  previousMetrics,
}: {
  summary: PortSummary;
  congestion: CongestionResult;
  metrics: KeyMetrics;
  previousCongestion?: CongestionResult;
  previousMetrics?: KeyMetrics;
}) {
  const pc = previousCongestion ?? congestion;
  const pm = previousMetrics ?? metrics;

  const tiles = [
    {
      label: "Congestion score",
      value: String(congestion.port_score),
      hint: `${congestion.hotspots.length} conflicts detected`,
      Icon: Activity,
      badge: <LevelBadge level={congestion.port_level} />,
      color: congestion.port_score >= 70 ? "text-destructive" : congestion.port_score >= 40 ? "text-warning" : "text-success",
      trend: <TrendArrow current={congestion.port_score} previous={pc.port_score} />,
    },
    {
      label: "Berths available",
      value: `${summary.operational_berths}/${summary.total_berths}`,
      hint: summary.operational_berths === summary.total_berths ? "All berths open" : "Capacity lost",
      Icon: Anchor,
      color: summary.operational_berths === summary.total_berths ? "text-success" : "text-warning",
      trend: null,
    },
    {
      label: "Cranes working",
      value: `${summary.available_cranes}/${summary.total_cranes}`,
      hint: "More cranes = faster handling",
      Icon: Cog,
      color: "text-info",
      trend: null,
    },
    {
      label: "Vessels waiting",
      value: String(summary.vessels_waiting),
      hint: `${summary.vessels_in_port} alongside now`,
      Icon: Ship,
      color: summary.vessels_waiting > 20 ? "text-warning" : "text-info",
      trend: null,
    },
    {
      label: "Avg wait",
      value: `${metrics.avg_wait_hours}h`,
      hint: `${metrics.delayed_vessel_count} vessels delayed`,
      Icon: Clock,
      color: metrics.avg_wait_hours > 48 ? "text-destructive" : metrics.avg_wait_hours > 24 ? "text-warning" : "text-success",
      trend: <TrendArrow current={metrics.avg_wait_hours} previous={pm.avg_wait_hours} />,
    },
    {
      label: "Berth utilisation",
      value: `${metrics.berth_utilization_pct}%`,
      hint: `Avg turnaround ${metrics.avg_turnaround_hours}h`,
      Icon: Gauge,
      color: metrics.berth_utilization_pct >= 90 ? "text-destructive" : metrics.berth_utilization_pct >= 70 ? "text-warning" : "text-success",
      trend: <TrendArrow current={metrics.berth_utilization_pct} previous={pm.berth_utilization_pct} lowerIsBetter={false} />,
    },
    {
      label: "Yard capacity",
      value: `${summary.yard_utilization_pct}%`,
      hint: summary.yard_saturation_blocks > 0
        ? `${summary.yard_saturation_blocks} block${summary.yard_saturation_blocks > 1 ? "s" : ""} saturated`
        : "All blocks below 90%",
      Icon: Warehouse,
      color: summary.yard_utilization_pct >= 90 ? "text-destructive" : summary.yard_utilization_pct >= 70 ? "text-warning" : "text-success",
      trend: null,
    },
  ];

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 xl:grid-cols-7 xl:overflow-visible">
        {tiles.map(({ label, value, hint, Icon, badge, color, trend }) => (
          <div key={label} className="panel min-w-[160px] p-4 transition-colors hover:border-primary/30 lg:min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
              <div className="flex items-center gap-1">
                {trend}
                <Icon className={`size-4 shrink-0 ${color}`} aria-hidden />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className={`num text-2xl font-bold ${color}`}>{value}</p>
              {badge}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{metrics.metric_note}</p>
    </div>
  );
}
