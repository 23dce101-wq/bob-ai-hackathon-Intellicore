// "Why is congestion rising?" — explainability layer.
// Pure, client-safe functions that turn the schedule into ranked, human-readable
// drivers. Nothing here is a black box: every line states the numbers it used.

import { HORIZON, berthUsable, buildSchedule, effectiveCranes } from "./schedule";
import type {
  Berth,
  CongestionDriver,
  CongestionLevel,
  ScheduleResult,
  Vessel,
  YardStatus,
} from "./types";

export interface WindowExplanation {
  hour: number;
  level: CongestionLevel;
  capacity: number;
  expected_arrivals: number;
  expected_waiting: number;
  closed_berths: string[];
  busiest_berth: { berth_id: string; utilization_pct: number } | null;
  factors: string[];
}

export function computeDrivers(
  berths: Berth[],
  vessels: Vessel[],
  schedule: ScheduleResult = buildSchedule(berths, vessels),
  yard?: YardStatus,
): CongestionDriver[] {
  const drivers: CongestionDriver[] = [];
  const usable = berths.filter(berthUsable);
  const closed = berths.filter((berth) => berth.status === "closed");
  const craneShort = berths.filter((berth) => berth.status === "operational" && berth.cranes_out > 0);
  const arrivals24 = vessels.filter((vessel) => vessel.eta_hours >= 0 && vessel.eta_hours <= 24);
  const delayed = schedule.entries.filter((entry) => entry.wait_hours > 0 || entry.blocked);
  const stranded = schedule.entries.filter((entry) => entry.blocked);
  const priorityDelayed = delayed.filter((entry) => entry.priority === "priority");

  const demandRatio = arrivals24.length / Math.max(1, usable.length);
  drivers.push({
    title: "Arrival demand vs berth capacity",
    detail: `${arrivals24.length} vessels arrive in the next 24 h against ${usable.length} usable berths (${demandRatio.toFixed(1)} vessels per berth).`,
    weight: Math.min(100, Math.round(demandRatio * 26)),
  });

  if (closed.length) {
    drivers.push({
      title: `${closed.length} berth${closed.length > 1 ? "s" : ""} out of service`,
      detail: `${closed.map((berth) => berth.berth_id).join(", ")} closed${closed[0]?.closure_reason ? ` — ${closed[0].closure_reason}` : ""}, removing ${closed.reduce((sum, berth) => sum + berth.crane_count, 0)} cranes from the plan.`,
      weight: Math.min(100, closed.length * 30),
    });
  }

  if (craneShort.length) {
    const lost = craneShort.reduce((sum, berth) => sum + berth.cranes_out, 0);
    drivers.push({
      title: "Crane outage slowing handling",
      detail: `${lost} crane${lost > 1 ? "s" : ""} down at ${craneShort.map((berth) => berth.berth_id).join(", ")}, stretching unload times at those berths.`,
      weight: Math.min(100, lost * 18),
    });
  }

  const busiest = [...schedule.utilization]
    .filter((item) => item.available_hours > 0)
    .sort((a, b) => b.utilization_pct - a.utilization_pct)[0];
  if (busiest) {
    drivers.push({
      title: `${busiest.berth_id} is the tightest berth`,
      detail: `Booked ${busiest.busy_hours} h of ${busiest.available_hours} h (${busiest.utilization_pct}% utilised) over the ${HORIZON} h window.`,
      weight: busiest.utilization_pct,
    });
  }

  if (stranded.length) {
    drivers.push({
      title: "Vessels with nowhere to berth",
      detail: `${stranded.length} vessel${stranded.length > 1 ? "s" : ""} cannot be serviced as scheduled: ${stranded
        .slice(0, 4)
        .map((entry) => entry.vessel_id)
        .join(", ")}.`,
      weight: Math.min(100, stranded.length * 22),
    });
  }

  if (priorityDelayed.length) {
    drivers.push({
      title: "Priority vessels queued behind others",
      detail: `${priorityDelayed.map((entry) => entry.vessel_id).join(", ")} carry priority cargo but still wait for a free berth.`,
      weight: Math.min(100, priorityDelayed.length * 24),
    });
  }

  const lowCrane = usable.filter((berth) => effectiveCranes(berth) <= 2);
  if (lowCrane.length) {
    drivers.push({
      title: "Low-crane berths handle cargo slowly",
      detail: `${lowCrane.map((berth) => `${berth.berth_id} (${effectiveCranes(berth)} cranes)`).join(", ")} take roughly ${Math.round((3 / Math.max(1, effectiveCranes(lowCrane[0]!))) * 100 - 100)}% longer per vessel than a 3-crane berth.`,
      weight: Math.min(100, lowCrane.length * 14),
    });
  }

  if (yard) {
    if (yard.saturated_blocks > 0) {
      drivers.push({
        title: `${yard.saturated_blocks} yard block${yard.saturated_blocks > 1 ? "s" : ""} at or above 90% saturation`,
        detail: `${yard.used_teu} of ${yard.total_teu} TEU slots occupied (${yard.utilization_pct}%). Saturated blocks cause delayed container retrieval and truck congestion.`,
        weight: Math.min(100, yard.saturated_blocks * 28),
      });
    }
    if (yard.rtg_availability_pct < 80) {
      drivers.push({
        title: "Yard crane (RTG) availability low",
        detail: `Only ${yard.rtg_availability_pct}% of rubber-tyred gantry cranes operational across yard blocks, slowing container stacking and retrieval.`,
        weight: Math.min(100, (100 - yard.rtg_availability_pct) * 1.2),
      });
    }
    if (yard.utilization_pct >= 75) {
      drivers.push({
        title: "Container yard nearing capacity",
        detail: `Yard at ${yard.utilization_pct}% capacity. High yard occupancy increases truck turnaround time and can block vessel unloading.`,
        weight: Math.min(100, Math.round((yard.utilization_pct - 60) * 2.5)),
      });
    }
  }

  return drivers.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

/** Per-window explanation used by the forecast "Why?" panel. */
export function explainWindow(
  hour: number,
  berths: Berth[],
  vessels: Vessel[],
  level: CongestionLevel,
  schedule: ScheduleResult = buildSchedule(berths, vessels),
): WindowExplanation {
  const usable = berths.filter(berthUsable);
  const closed = berths.filter((berth) => !berthUsable(berth)).map((berth) => berth.berth_id);
  const arrivals = vessels.filter(
    (vessel) => vessel.eta_hours >= hour && vessel.eta_hours < hour + 6,
  );
  const waiting = schedule.entries.filter(
    (entry) =>
      entry.arrival <= hour && (entry.service_start === null || entry.service_start > hour),
  );
  const busiest = [...schedule.utilization]
    .filter((item) => item.available_hours > 0)
    .sort((a, b) => b.utilization_pct - a.utilization_pct)[0];

  const factors = [
    `Capacity in window: ${usable.length} usable berths, ${usable.reduce((sum, berth) => sum + effectiveCranes(berth), 0)} working cranes.`,
    `Expected arrivals +${hour}h to +${hour + 6}h: ${arrivals.length} vessel${arrivals.length === 1 ? "" : "s"}${arrivals.length ? ` (${arrivals.map((vessel) => vessel.vessel_id).join(", ")})` : ""}.`,
    `Vessels still queueing at +${hour}h: ${waiting.length}.`,
    closed.length
      ? `Out of service: ${closed.join(", ")}.`
      : `All ${usable.length} berths are available in this window.`,
    busiest
      ? `Tightest berth: ${busiest.berth_id} at ${busiest.utilization_pct}% utilisation.`
      : "No berth utilisation recorded.",
    `Result: queue pressure of ${(waiting.length / Math.max(1, usable.length)).toFixed(1)} vessels per berth puts this window at ${level.toUpperCase()}.`,
  ];

  return {
    hour,
    level,
    capacity: usable.length,
    expected_arrivals: arrivals.length,
    expected_waiting: waiting.length,
    closed_berths: closed,
    busiest_berth: busiest
      ? { berth_id: busiest.berth_id, utilization_pct: busiest.utilization_pct }
      : null,
    factors,
  };
}
