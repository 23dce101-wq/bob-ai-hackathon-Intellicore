// Dynamic crane rebalancing: moves unused cranes from idle berths to congested ones.
// This models the real-world practice of crane gang borrowing between terminals.

import type { Berth, CraneRebalanceMove, Vessel } from "./types";
import { buildSchedule, berthUsable, effectiveCranes, serviceHours } from "./schedule";
import { detectCongestion } from "./congestion";

export function computeCraneRebalance(
  berths: Berth[],
  vessels: Vessel[],
): CraneRebalanceMove[] {
  const moves: CraneRebalanceMove[] = [];

  // Compute schedule once — reuse for all berth pair comparisons.
  const schedule = buildSchedule(berths, vessels);

  const usableBerths = berths.filter(berthUsable);

  for (const targetBerth of usableBerths) {
    const targetEntries = schedule.entries.filter(
      (e) => e.berth_id === targetBerth.berth_id,
    );
    const targetDelayed = targetEntries.filter((e) => e.wait_hours > 0);
    const targetUtil = targetEntries.length > 0
      ? targetEntries.reduce((s, e) => s + e.service_hours, 0) / 72 * 100
      : 0;

    // Target needs more cranes if it has delays and high utilization
    if (targetDelayed.length < 2 || targetUtil < 60) continue;

    for (const sourceBerth of usableBerths) {
      if (sourceBerth.berth_id === targetBerth.berth_id) continue;

      const sourceEntries = schedule.entries.filter(
        (e) => e.berth_id === sourceBerth.berth_id,
      );
      const sourceBusy = sourceEntries.filter(
        (e) => e.service_start !== null && e.service_end !== null,
      );

      // Source must have spare cranes (more than 1 working, some idle time)
      const sourceCranes = effectiveCranes(sourceBerth);
      const sourceIdleHours = 72 - sourceBusy.reduce((s, e) => s + e.service_hours, 0);
      const cranesSurplus = Math.max(0, sourceCranes - 2); // always keep at least 2

      if (cranesSurplus < 1 || sourceIdleHours < 12) continue;

      const cranesToMove = Math.min(cranesSurplus, 2);
      const congestionReduction = Math.min(30, targetDelayed.length * 5 + cranesToMove * 8);

      moves.push({
        from_berth_id: sourceBerth.berth_id,
        to_berth_id: targetBerth.berth_id,
        cranes_moved: cranesToMove,
        reason: `${sourceBerth.berth_id} has ${sourceCranes} cranes but only ${sourceBusy.length} vessels queued. ${targetBerth.berth_id} has ${targetDelayed.length} delayed vessels needing faster turnaround.`,
        congestion_reduction_estimate: congestionReduction,
      });

      // Only one rebalance move per target to keep it realistic
      break;
    }
  }

  return moves.sort((a, b) => b.congestion_reduction_estimate - a.congestion_reduction_estimate);
}
