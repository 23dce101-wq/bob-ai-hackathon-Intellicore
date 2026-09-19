import { useMemo } from "react";
import { CalendarClock, Wand2 } from "lucide-react";
import type { Berth, OptimizationResult, Vessel } from "@/lib/port/types";
import { HORIZON, berthUsable, buildSchedule, effectiveCranes } from "@/lib/port/schedule";
import { Pill } from "./StatusBadge";
import { cn } from "@/lib/utils";

const TICKS = [0, 12, 24, 36, 48, 60, 72];

// Real 72-hour berth plan: one row per berth, one bar per service window.
export function GanttPlan({ berths, vessels, optimization }: { berths: Berth[]; vessels: Vessel[]; optimization?: OptimizationResult }) {
  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);
  const blocked = schedule.entries.filter((entry) => entry.blocked);
  const reassigned = useMemo(
    () => new Set(optimization?.moves.map((m) => m.vessel_id) ?? []),
    [optimization],
  );

  return (
    <section className="panel p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              72-hour berth plan (Gantt)
            </h2>
            <p className="text-xs text-muted-foreground">
              Every bar is one vessel&apos;s service window, derived from the same schedule as the
              simulation
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-success" aria-hidden /> On time
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-warning" aria-hidden /> Delayed start
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-destructive" aria-hidden /> Cannot berth
          </span>
          {optimization && reassigned.size > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="flex items-center gap-0.5 rounded-sm ring-1 ring-info px-1 py-0.5 text-[10px] font-medium text-info">
                <Wand2 className="size-2.5" /> Reassigned
              </span>
            </span>
          )}
        </div>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="mb-1 flex pl-24 text-xs text-muted-foreground">
            {TICKS.map((tick) => (
              <span key={tick} className="num flex-1 first:flex-[0_0_0]">
                +{tick}h
              </span>
            ))}
          </div>

          <div className="space-y-1.5">
            {berths.map((berth) => {
              const entries = schedule.entries.filter((entry) => entry.berth_id === berth.berth_id);
              const util = schedule.utilization.find((item) => item.berth_id === berth.berth_id);
              const usable = berthUsable(berth);

              return (
                <div key={berth.berth_id} className="flex items-center gap-2">
                  <div className="w-24 shrink-0">
                    <p className="num text-sm font-medium">{berth.berth_id}</p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {effectiveCranes(berth)}/{berth.crane_count} cranes · {util?.utilization_pct ?? 0}%
                    </p>
                  </div>
                  <div
                    className={cn(
                      "relative h-9 flex-1 overflow-hidden rounded-md border",
                      usable ? "border-border bg-surface/60" : "border-destructive/50 bg-destructive/10",
                    )}
                  >
                    {TICKS.map((tick) => (
                      <span
                        key={tick}
                        className="absolute top-0 bottom-0 w-px bg-border/70"
                        style={{ left: `${(tick / HORIZON) * 100}%` }}
                        aria-hidden
                      />
                    ))}

                    {!usable && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-destructive">
                        {berth.closure_reason
                          ? `Out of service — ${berth.closure_reason}`
                          : "Out of service"}
                      </span>
                    )}

                      {usable &&
                      entries
                        .filter((entry) => entry.service_start !== null)
                        .map((entry) => {
                          const start = Math.max(0, entry.service_start!);
                          const end = Math.min(HORIZON, entry.service_end!);
                          if (end <= 0 || start >= HORIZON) return null;
                          const left = (start / HORIZON) * 100;
                          const width = Math.max(1.5, ((end - start) / HORIZON) * 100);
                          const late = entry.wait_hours > 0;
                          const isReassigned = reassigned.has(entry.vessel_id);
                          return (
                            <span
                              key={entry.vessel_id}
                              title={`${entry.vessel_id} · ${entry.type} · service +${entry.service_start}h → +${entry.service_end}h · wait ${entry.wait_hours}h · ${entry.cranes_assigned} cranes${isReassigned ? " · reassigned by optimiser" : ""}`}
                              className={cn(
                                "absolute top-1 bottom-1 flex items-center overflow-hidden rounded px-1.5 text-[0.7rem] font-medium",
                                late
                                  ? "bg-warning/25 text-warning ring-1 ring-warning/50"
                                  : "bg-success/20 text-success ring-1 ring-success/40",
                                isReassigned && "ring-2 ring-info ring-offset-1",
                              )}
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <span className="num truncate">{entry.vessel_id}</span>
                            </span>
                          );
                        })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {blocked.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-destructive uppercase">
            {blocked.length} vessel{blocked.length > 1 ? "s" : ""} cannot be berthed in this plan
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {blocked.map((entry) => (
              <li key={entry.vessel_id} className="flex flex-wrap items-center gap-2">
                <Pill variant="danger">{entry.vessel_id}</Pill>
                <span>
                  arrives +{entry.arrival}h · {entry.block_reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
