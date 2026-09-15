// Macro-routing strategies: slow-steaming, offshore holding, secondary port diversion.
// These advise vessels that haven't arrived yet on how to adjust their approach
// to reduce congestion at the terminal.

import type { Berth, MacroRoutingAdvice, Vessel } from "./types";

const SECONDARY_PORTS = ["Port Alpha (38 nm east)", "Port Beta (52 nm north)"];

// Seeded PRNG for deterministic routing decisions
function seededValue(seed: number): number {
  let a = seed | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function computeMacroRouting(
  berths: Berth[],
  vessels: Vessel[],
  portCongestionScore: number,
): MacroRoutingAdvice[] {
  const advice: MacroRoutingAdvice[] = [];
  const incoming = vessels.filter(
    (v) => v.eta_hours > 4 && v.status !== "Docked" && v.assigned_berth_id !== null,
  );

  for (let i = 0; i < incoming.length; i++) {
    const vessel = incoming[i]!;
    const assignedBerth = berths.find((b) => b.berth_id === vessel.assigned_berth_id);
    if (!assignedBerth) continue;

    // Deterministic pseudo-random based on vessel index and congestion
    const deterministicRand = seededValue(i * 1000 + portCongestionScore);

    // Check if vessel's assigned berth is congested or closed
    const berthCongested =
      assignedBerth.status === "closed" ||
      assignedBerth.cranes_out >= assignedBerth.crane_count;

    if (portCongestionScore >= 75 || berthCongested) {
      const delayHours = Math.min(8, Math.round(portCongestionScore / 12));
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "slow_steaming",
        detail: `Reduce speed to arrive +${delayHours}h later. This lets ${assignedBerth.berth_id} clear the current backlog and avoids anchorage waiting.`,
        fuel_savings_kg: Math.round(delayHours * 45 + deterministicRand * 120),
        time_impact_hours: delayHours,
        target_port: null,
      });
    }

    if (portCongestionScore >= 85 && vessel.type !== "Tanker") {
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "offshore_holding",
        detail: `Hold at designated offshore anchorage (4 nm south) until congestion drops below critical. Estimated hold: ${Math.round(portCongestionScore / 15)}h.`,
        fuel_savings_kg: null,
        time_impact_hours: Math.round(portCongestionScore / 15),
        target_port: null,
      });
    }

    if (portCongestionScore >= 90 && vessel.type === "Bulk") {
      const target = SECONDARY_PORTS[Math.floor(deterministicRand * SECONDARY_PORTS.length)]!;
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "divert_secondary_port",
        detail: `Divert to ${target}. ${assignedBerth.berth_id} is critically congested and Bulk cargo can be handled at the secondary facility.`,
        fuel_savings_kg: null,
        time_impact_hours: -2,
        target_port: target,
      });
    }

    if (vessel.eta_hours > 24 && vessel.eta_hours < 48) {
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "advance_booking",
        detail: `Pre-book ${assignedBerth.berth_id} service window for +${vessel.eta_hours}h arrival to guarantee priority handling.`,
        fuel_savings_kg: null,
        time_impact_hours: 0,
        target_port: null,
      });
    }
  }

  return advice.sort((a, b) => {
    const order = { divert_secondary_port: 0, slow_steaming: 1, offshore_holding: 2, advance_booking: 3 };
    return (order[a.strategy] ?? 4) - (order[b.strategy] ?? 4);
  });
}
