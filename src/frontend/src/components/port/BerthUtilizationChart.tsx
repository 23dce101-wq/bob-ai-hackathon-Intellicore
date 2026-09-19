import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { Berth, Vessel } from "@/lib/port/types";
import { buildSchedule } from "@/lib/port/schedule";

export function BerthUtilizationChart({
  berths,
  vessels,
}: {
  berths: Berth[];
  vessels: Vessel[];
}) {
  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);

  const data = berths.map((berth) => {
    const util = schedule.utilization.find((u) => u.berth_id === berth.berth_id);
    const queue = schedule.entries.filter(
      (e) => e.berth_id === berth.berth_id && !e.blocked,
    );
    const delayed = queue.filter((e) => e.wait_hours > 0);
    return {
      id: berth.berth_id,
      utilization: util?.utilization_pct ?? 0,
      queueLength: queue.length,
      delayedCount: delayed.length,
      cranes: berth.crane_count,
    };
  });

  const maxUtil = Math.max(...data.map((d) => d.utilization), 1);

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <BarChart3 className="size-4 text-primary" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Berth utilisation comparison
          </h2>
          <p className="text-xs text-muted-foreground">
            Busy hours vs available capacity per berth over 72h
          </p>
        </div>
      </header>

      <div className="divide-y divide-border/30">
        {data.map((d) => {
          const barWidth = (d.utilization / maxUtil) * 100;
          const color =
            d.utilization >= 90
              ? "bg-destructive"
              : d.utilization >= 70
                ? "bg-warning"
                : "bg-success";
          return (
            <div key={d.id} className="flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-primary/5">
              <div className="w-16 shrink-0">
                <p className="num text-sm font-bold">{d.id}</p>
                <p className="text-[10px] text-muted-foreground">
                  {d.cranes} cranes
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {d.queueLength} vessels
                    {d.delayedCount > 0 && (
                      <span className="ml-1 text-warning">({d.delayedCount} delayed)</span>
                    )}
                  </span>
                  <span className="num font-bold">{d.utilization}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-5 border-t border-border bg-card/30 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-success" /> {"< 70%"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-warning" /> 70-89%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-destructive" /> 90%+
        </span>
      </div>
    </section>
  );
}
