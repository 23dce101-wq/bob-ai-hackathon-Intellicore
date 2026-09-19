// Congestion detection: pure, explainable heuristics — no machine learning.
// Everything is derived from the shared berth schedule in schedule.ts, so the
// hotspots, the Gantt plan, the simulation and the tables always agree.

import { HORIZON, berthUsable, berthUsableNow, buildSchedule, effectiveCranes } from "./schedule";
import type {
  Berth,
  BerthCongestion,
  CongestionLevel,
  CongestionResult,
  Hotspot,
  KeyMetrics,
  PortSummary,
  ScheduleResult,
  Vessel,
  YardBlock,
  YardStatus,
} from "./types";

export function levelFromScore(score: number): CongestionLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 28) return "medium";
  return "low";
}

function severityFromOverlap(hours: number): CongestionLevel {
  if (hours >= 16) return "critical";
  if (hours >= 10) return "high";
  if (hours >= 4) return "medium";
  return "low";
}

/**
 * Walks the shared schedule and reports every vessel that cannot berth on
 * arrival, plus per-berth and port-wide congestion scores.
 * Also returns vessels with wait_time_hours / status recomputed.
 */
export function detectCongestion(
  berths: Berth[],
  vessels: Vessel[],
  windowStart = -Infinity,
  windowEnd = Infinity,
): { result: CongestionResult; vessels: Vessel[]; schedule: ScheduleResult } {
  const updated = vessels.map((vessel) => ({ ...vessel, wait_time_hours: 0 }));
  const schedule = buildSchedule(berths, updated);
  const hotspots: Hotspot[] = [];

  for (const entry of schedule.entries) {
    const vessel = updated.find((item) => item.vessel_id === entry.vessel_id);
    if (!vessel) continue;

    if (entry.blocked) {
      // Compute actual wait based on vessel's ETA and when it can realistically be served
      const berth = entry.berth_id ? berths.find((b) => b.berth_id === entry.berth_id) : null;
      const reopenHour = berth ? (berth.status === "closed" ? berth.closure_end_hour ?? 72 : berth.cranes_out > 0 ? 12 : 0) : 24;
      vessel.wait_time_hours = Math.max(entry.wait_hours, reopenHour);
      vessel.status = "Waiting";
    } else {
      vessel.wait_time_hours = entry.wait_hours;
      const start = entry.service_start ?? 0;
      const end = entry.service_end ?? 0;
      vessel.status =
        start <= 0 && end > 0 ? "Docked" : entry.wait_hours > 0 ? "Waiting" : "En Route";
    }

    const inWindow = entry.arrival >= windowStart && entry.arrival < windowEnd;
    if (!inWindow) continue;

    if (entry.blocked) {
      hotspots.push({
        berth_id: entry.berth_id ?? "—",
        vessel_id: entry.vessel_id,
        eta_hours: entry.arrival,
        berth_free_at: Number.POSITIVE_INFINITY,
        overlap_hours: vessel.wait_time_hours,
        severity: "critical",
        reason: entry.block_reason ?? "Vessel cannot be serviced",
      });
    } else if (entry.wait_hours > 0) {
      hotspots.push({
        berth_id: entry.berth_id ?? "—",
        vessel_id: entry.vessel_id,
        eta_hours: entry.arrival,
        berth_free_at: entry.service_start ?? 0,
        overlap_hours: entry.wait_hours,
        severity: severityFromOverlap(entry.wait_hours),
        reason: `Arrives +${entry.arrival}h but ${entry.berth_id} is busy until +${entry.service_start}h`,
      });
    }
  }

  const berthStats: BerthCongestion[] = berths.map((berth) => {
    const entries = schedule.entries.filter((entry) => entry.berth_id === berth.berth_id);
    const util = schedule.utilization.find((item) => item.berth_id === berth.berth_id);
    const utilization = util?.utilization_pct ?? 0;

    if (!berthUsable(berth)) {
      return {
        berth_id: berth.berth_id,
        overlap_count: entries.length,
        avg_wait_hours: entries.length ? 24 : 0,
        utilization_pct: 0,
        score: entries.length ? 100 : 40,
        level: entries.length ? "critical" : "medium",
      };
    }

    const delayed = entries.filter(
      (entry) => entry.wait_hours > 0 && entry.arrival >= windowStart && entry.arrival < windowEnd,
    );
    const avgWait = delayed.length
      ? delayed.reduce((sum, entry) => sum + entry.wait_hours, 0) / delayed.length
      : 0;
    const craneFactor = 3 / Math.max(1, effectiveCranes(berth));
    const raw = delayed.length * avgWait * craneFactor * 1.6 + Math.max(0, utilization - 85) * 0.9;

    return {
      berth_id: berth.berth_id,
      overlap_count: delayed.length,
      avg_wait_hours: Math.round(avgWait * 10) / 10,
      utilization_pct: utilization,
      score: Math.min(100, Math.round(raw)),
      level: levelFromScore(Math.min(100, raw)),
    };
  });

  const portScore = berthStats.length
    ? Math.min(
        100,
        Math.round(berthStats.reduce((sum, item) => sum + item.score, 0) / berthStats.length),
      )
    : 0;

  return {
    result: {
      hotspots: hotspots.sort((a, b) => b.overlap_hours - a.overlap_hours),
      berths: berthStats,
      port_score: portScore,
      port_level: levelFromScore(portScore),
    },
    vessels: updated,
    schedule,
  };
}

export function buildSummary(berths: Berth[], vessels: Vessel[], yard: YardBlock[]): PortSummary {
  const totalT = yard.reduce((s, b) => s + b.total_teu, 0);
  const usedT = yard.reduce((s, b) => s + b.used_teu, 0);
  return {
    total_berths: berths.length,
    operational_berths: berths.filter(berthUsableNow).length,
    total_cranes: berths.reduce((sum, berth) => sum + berth.crane_count, 0),
    available_cranes: berths
      .filter((berth) => berth.status === "operational")
      .reduce((sum, berth) => sum + effectiveCranes(berth), 0),
    vessels_in_port: vessels.filter((vessel) => vessel.status === "Docked").length,
    vessels_waiting: vessels.filter((vessel) => vessel.status === "Waiting").length,
    yard_utilization_pct: totalT ? Math.round((usedT / totalT) * 100) : 0,
    yard_saturation_blocks: yard.filter((b) => b.used_teu / b.total_teu >= 0.9).length,
  };
}

export function buildMetrics(
  berths: Berth[],
  vessels: Vessel[],
  schedule: ScheduleResult,
): KeyMetrics {
  const waits = vessels.map((vessel) => vessel.wait_time_hours);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;

  const turnarounds = schedule.entries.map(
    (entry) => entry.service_hours + (entry.blocked ? 24 : entry.wait_hours),
  );
  const avgTurnaround = turnarounds.length
    ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length
    : 0;

  return {
    avg_wait_hours: Math.round(avgWait * 10) / 10,
    avg_turnaround_hours: Math.round(avgTurnaround * 10) / 10,
    berth_utilization_pct: schedule.port_utilization_pct,
    delayed_vessel_count: vessels.filter((vessel) => vessel.wait_time_hours > 0).length,
    metric_note: `Berth utilisation = busy berth-hours / available berth-hours across the next ${HORIZON} h. Wait and turnaround are averaged over all scheduled vessels.`,
  };
}

export function buildYardStatus(blocks: YardBlock[]): YardStatus {
  const totalT = blocks.reduce((s, b) => s + b.total_teu, 0);
  const usedT = blocks.reduce((s, b) => s + b.used_teu, 0);
  const saturated = blocks.filter((b) => b.used_teu / b.total_teu >= 0.9).length;
  const operationalRtgs = blocks.filter((b) => b.rtg_operational).reduce((s, b) => s + b.rtg_count, 0);
  const totalRtgs = blocks.reduce((s, b) => s + b.rtg_count, 0);
  const utilPct = totalT ? Math.round((usedT / totalT) * 100) : 0;

  let level: CongestionLevel = "low";
  if (utilPct >= 90 || saturated >= 2) level = "critical";
  else if (utilPct >= 75 || saturated >= 1) level = "high";
  else if (utilPct >= 55) level = "medium";

  return {
    blocks,
    total_teu: totalT,
    used_teu: usedT,
    utilization_pct: utilPct,
    saturated_blocks: saturated,
    rtg_availability_pct: totalRtgs ? Math.round((operationalRtgs / totalRtgs) * 100) : 0,
    level,
  };
}
