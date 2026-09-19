import { useMemo } from "react";
import { Anchor } from "lucide-react";
import type { Berth, OptimizationResult, Vessel } from "@/lib/port/types";
import { berthUsable, buildSchedule, effectiveCranes } from "@/lib/port/schedule";
import { Pill } from "./StatusBadge";

// Berth & crane allocation: capacity, compatibility, load and planned changes.
export function AllocationTable({
  berths,
  vessels,
  optimization,
}: {
  berths: Berth[];
  vessels: Vessel[];
  optimization: OptimizationResult;
}) {
  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Anchor className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">Berth &amp; crane allocation</h2>
          <p className="text-xs text-muted-foreground">
            Capacity, compatibility and load across 72h
          </p>
        </div>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Berth</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-center font-medium">Cranes</th>
              <th className="px-4 py-2.5 text-left font-medium hide-mobile">Handles</th>
              <th className="px-4 py-2.5 text-left font-medium">Current</th>
              <th className="px-4 py-2.5 text-center font-medium">Queue</th>
              <th className="px-4 py-2.5 text-center font-medium">Utilisation</th>
              <th className="px-4 py-2.5 text-left font-medium hide-mobile">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {berths.map((berth) => {
              const util = schedule.utilization.find((item) => item.berth_id === berth.berth_id);
              const queue = schedule.entries.filter((entry) => entry.berth_id === berth.berth_id);
              const incoming = optimization.moves.filter((move) => move.to_berth_id === berth.berth_id);
              const outgoing = optimization.moves.filter(
                (move) => move.from_berth_id === berth.berth_id,
              );
              const usable = berthUsable(berth);
              const utilPct = util?.utilization_pct ?? 0;

              return (
                <tr key={berth.berth_id} className="transition-colors hover:bg-primary/5">
                  <td className="px-4 py-2.5">
                    <span className="num text-sm font-bold">{berth.berth_id}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill variant={usable ? "success" : "danger"}>
                      {berth.status === "closed" ? "Closed" : usable ? "Operational" : "No cranes"}
                    </Pill>
                  </td>
                  <td className="num px-4 py-2.5 text-center text-sm">
                    <span className="font-semibold">{effectiveCranes(berth)}</span>
                    <span className="text-muted-foreground">/{berth.crane_count}</span>
                    {berth.cranes_out > 0 && (
                      <span className="ml-1 text-xs text-warning">↓</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs hide-mobile">
                    <div className="flex flex-wrap gap-1">
                      {berth.compatible_types.map((type) => (
                        <span key={type} className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {type}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {berth.current_vessel_id ? (
                      <span className="num font-medium text-success">{berth.current_vessel_id}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="num px-4 py-2.5 text-center text-sm">
                    <span className={queue.length > 10 ? "font-semibold text-warning" : ""}>
                      {queue.length}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all ${
                            utilPct >= 90 ? "bg-destructive" : utilPct >= 70 ? "bg-warning" : "bg-success"
                          }`}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                      <span className="num text-xs font-medium w-8 text-right">{utilPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 hide-mobile">
                    {incoming.length === 0 && outgoing.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {incoming.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                            +{incoming.length}
                          </span>
                        )}
                        {outgoing.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                            −{outgoing.length}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
