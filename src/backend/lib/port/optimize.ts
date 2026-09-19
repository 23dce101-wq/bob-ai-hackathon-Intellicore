import { buildMetrics, detectCongestion } from "./congestion";
import { berthUsable, buildSchedule, compatible, effectiveCranes, serviceHours } from "./schedule";
import type {
  Berth,
  CraneTransfer,
  OptimizationResult,
  ReassignmentMove,
  RoutingStrategy,
  Vessel,
} from "./types";

function berthFreeAt(
  berth: Berth,
  berths: Berth[],
  vessels: Vessel[],
  ignoreVesselId: string,
): number {
  const trimmed = vessels.filter((vessel) => vessel.vessel_id !== ignoreVesselId);
  const schedule = buildSchedule(berths, trimmed);
  const ends = schedule.entries
    .filter((entry) => entry.berth_id === berth.berth_id && entry.service_end !== null)
    .map((entry) => entry.service_end as number);
  return ends.length ? Math.max(...ends) : 0;
}

/**
 * Computes macro-level routing strategies (slow steaming, offshore anchorage staging, inter-terminal diversion).
 */
export function computeRoutingStrategies(
  vessels: Vessel[],
  berths: Berth[],
): RoutingStrategy[] {
  const strategies: RoutingStrategy[] = [];

  for (const vessel of vessels) {
    const baseSpeed = vessel.type === "Container" ? 19.5 : vessel.type === "Bulk" ? 14.0 : 15.0;
    const wait = vessel.wait_time_hours;
    const eta = vessel.eta_hours;

    if (vessel.status === "Docked") {
      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "direct_berth",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: baseSpeed,
        speed_reduction_pct: 0,
        fuel_saved_tons: 0,
        co2_saved_tons: 0,
        anchorage_zone: null,
        diversion_terminal: null,
        holding_hours: 0,
        rationale: "Vessel is actively alongside berth and discharging cargo.",
      });
      continue;
    }

    if (wait >= 24) {
      // Long backlog: Inter-terminal diversion recommendation
      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "inter_terminal_divert",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: 13.0,
        speed_reduction_pct: Math.round(((baseSpeed - 13.0) / baseSpeed) * 100),
        fuel_saved_tons: 14.2,
        co2_saved_tons: 44.2,
        anchorage_zone: "Fairway Staging Zone Delta",
        diversion_terminal: "South Harbor Pier 400 (Alternate Terminal)",
        holding_hours: wait,
        rationale: `Extreme wait of ${wait}h exceeds commercial demurrage threshold. Advise inter-terminal diversion to regional partner facility.`,
      });
    } else if (wait >= 10) {
      // Moderate-to-high backlog: Offshore Anchorage Staging Zone
      const anchorZone =
        vessel.type === "Container"
          ? "Anchorage Area Bravo (Deep Water Outer)"
          : "Anchorage Area Charlie (General Anchorage)";
      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "anchorage_holding",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: 12.0,
        speed_reduction_pct: Math.round(((baseSpeed - 12.0) / baseSpeed) * 100),
        fuel_saved_tons: Math.round(wait * 0.45 * 10) / 10,
        co2_saved_tons: Math.round(wait * 0.45 * 3.114 * 10) / 10,
        anchorage_zone: anchorZone,
        diversion_terminal: null,
        holding_hours: wait,
        rationale: `Hold in designated offshore anchorage ${anchorZone} to keep main channel unobstructed until scheduled pilot window at +${Math.round((eta + wait) * 10) / 10}h.`,
      });
    } else if (wait >= 3 && eta > 4) {
      // Manageable delay: Slow steaming speed advisory to achieve Just-In-Time (JIT) arrival
      // By reducing speed to arrive exactly when the berth opens, ship saves bunker fuel and cuts greenhouse gases
      const ratio = eta / (eta + wait);
      const targetSpeed = Math.max(11.5, Math.round(baseSpeed * ratio * 10) / 10);
      const reduction = Math.round(((baseSpeed - targetSpeed) / baseSpeed) * 100);
      const fuelSaved = Math.round(wait * 0.38 * 10) / 10;
      const co2Saved = Math.round(fuelSaved * 3.114 * 10) / 10;

      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "slow_steaming",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: targetSpeed,
        speed_reduction_pct: reduction,
        fuel_saved_tons: fuelSaved,
        co2_saved_tons: co2Saved,
        anchorage_zone: null,
        diversion_terminal: null,
        holding_hours: 0,
        rationale: `Slow-steam speed advisory: reduce cruising speed from ${baseSpeed} kts to ${targetSpeed} kts (${reduction}% cut). Arrives JIT when berth frees up, eliminating offshore idle time, saving ${fuelSaved}t bunker fuel and ${co2Saved}t CO2.`,
      });
    } else {
      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "direct_berth",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: baseSpeed,
        speed_reduction_pct: 0,
        fuel_saved_tons: 0,
        co2_saved_tons: 0,
        anchorage_zone: null,
        diversion_terminal: null,
        holding_hours: 0,
        rationale: "Berth window clear on arrival. Maintain scheduled cruising speed for immediate pilot boarding.",
      });
    }
  }

  return strategies;
}

/**
 * Optimises berth allocations with greedy heuristic, dynamic crane gang pooling, and macro routing.
 */
export function optimizeAllocation(berths: Berth[], vessels: Vessel[]): OptimizationResult {
  const before = detectCongestion(berths, vessels);
  const workingVessels = before.vessels.map((vessel) => ({ ...vessel }));
  const workingBerths = berths.map((berth) => ({ ...berth }));
  const moves: ReassignmentMove[] = [];
  const unresolved: string[] = [];
  const craneTransfers: CraneTransfer[] = [];

  // --- DYNAMIC CRANE GANG POOLING ---
  // If container berths have heavy backlogs, dynamically pool unused cranes from idle berths
  const initialSchedule = buildSchedule(workingBerths, workingVessels);
  const idleBerth = workingBerths.find(
    (b) =>
      b.status === "operational" &&
      effectiveCranes(b) >= 2 &&
      (initialSchedule.utilization.find((u) => u.berth_id === b.berth_id)?.utilization_pct ?? 0) < 35,
  );
  const congestedBerth = workingBerths.find(
    (b) =>
      b.status === "operational" &&
      b.compatible_types.includes("Container") &&
      effectiveCranes(b) < 6 &&
      (initialSchedule.utilization.find((u) => u.berth_id === b.berth_id)?.utilization_pct ?? 0) > 70,
  );

  if (idleBerth && congestedBerth && idleBerth.berth_id !== congestedBerth.berth_id) {
    idleBerth.crane_count -= 1;
    congestedBerth.crane_count += 1;
    craneTransfers.push({
      transfer_id: `CT-${idleBerth.berth_id}-${congestedBerth.berth_id}`,
      from_berth_id: idleBerth.berth_id,
      to_berth_id: congestedBerth.berth_id,
      cranes_moved: 1,
      hours_duration: 36,
      rationale: `Shifted 1 mobile STS crane gang from low-demand ${idleBerth.berth_id} to heavily backlogged container quay ${congestedBerth.berth_id} to accelerate container discharge rate.`,
    });
  }

  // --- GREEDY BERTH REASSIGNMENT ---
  const openBerths = workingBerths.filter(berthUsable);
  const overflow = [...before.result.hotspots].sort((a, b) => b.overlap_hours - a.overlap_hours);

  for (const hotspot of overflow) {
    const vessel = workingVessels.find((item) => item.vessel_id === hotspot.vessel_id);
    if (!vessel || vessel.status === "Docked") continue;

    const currentBerthId = vessel.assigned_berth_id;
    const waitBefore = vessel.wait_time_hours;

    let bestBerth: Berth | null = null;
    let bestFree = Number.POSITIVE_INFINITY;

    for (const berth of openBerths) {
      if (berth.berth_id === currentBerthId) continue;
      if (!compatible(berth, vessel)) continue;
      const free = berthFreeAt(berth, workingBerths, workingVessels, vessel.vessel_id);
      const better =
        free < bestFree ||
        (free === bestFree && bestBerth !== null && effectiveCranes(berth) > effectiveCranes(bestBerth));
      if (better) {
        bestFree = free;
        bestBerth = berth;
      }
    }

    if (!bestBerth) {
      unresolved.push(vessel.vessel_id);
      continue;
    }

    const waitAfter = Math.max(0, Math.round((bestFree - vessel.eta_hours) * 10) / 10);
    if (waitAfter >= waitBefore) {
      unresolved.push(vessel.vessel_id);
      continue;
    }

    const cranes = effectiveCranes(bestBerth);
    const hours = serviceHours(vessel, bestBerth);
    vessel.assigned_berth_id = bestBerth.berth_id;
    vessel.wait_time_hours = waitAfter;

    moves.push({
      vessel_id: vessel.vessel_id,
      from_berth_id: currentBerthId,
      to_berth_id: bestBerth.berth_id,
      wait_before_hours: waitBefore,
      wait_after_hours: waitAfter,
      hours_saved: Math.round((waitBefore - waitAfter) * 10) / 10,
      cranes_assigned: cranes,
      reason_lines: [
        currentBerthId
          ? `${currentBerthId} cannot take ${vessel.vessel_id}: ${hotspot.reason}.`
          : `${vessel.vessel_id} had no compatible berth assigned.`,
        `${bestBerth.berth_id} frees at +${Math.round(bestFree * 10) / 10}h and handles ${vessel.type} cargo.`,
        `${cranes} cranes there unload ${vessel.cargo} in about ${hours} h, cutting the wait from ${waitBefore} h to ${waitAfter} h.`,
      ],
    });
  }

  const after = detectCongestion(workingBerths, workingVessels);

  // --- MACRO ROUTING STRATEGIES ---
  const routingStrategies = computeRoutingStrategies(after.vessels, workingBerths);
  const totalFuelSaved = Math.round(
    routingStrategies.reduce((sum, r) => sum + r.fuel_saved_tons, 0) * 10,
  ) / 10;
  const totalCo2Saved = Math.round(
    routingStrategies.reduce((sum, r) => sum + r.co2_saved_tons, 0) * 10,
  ) / 10;

  // Attach routing strategy to vessels
  for (const vessel of after.vessels) {
    vessel.routing_strategy = routingStrategies.find((r) => r.vessel_id === vessel.vessel_id);
  }

  return {
    moves,
    unresolved: [...new Set(unresolved)],
    before: before.result,
    after: after.result,
    metrics_before: buildMetrics(berths, before.vessels, before.schedule),
    metrics_after: buildMetrics(workingBerths, after.vessels, after.schedule),
    hours_saved_total: Math.round(moves.reduce((sum, move) => sum + move.hours_saved, 0) * 10) / 10,
    vessels_after: after.vessels,
    routing_strategies: routingStrategies,
    crane_transfers: craneTransfers,
    fuel_saved_total_tons: totalFuelSaved,
    co2_saved_total_tons: totalCo2Saved,
  };
}
