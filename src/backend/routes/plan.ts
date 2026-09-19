import { Request, Response } from "express";
import { buildPortState } from "../lib/state.js";
import { buildSchedule } from "../lib/schedule.js";
import { streamText } from "../ai/index.js";

const PLAN_SYSTEM_PROMPT = `You are a port operations assistant writing a 72-hour operational plan for a shift supervisor.

STRICT RULES:
1. Use ONLY the supplied port state data - never invent vessels, berths, hours, or causes
2. Never discuss topics outside port operations
3. Always cite specific vessel IDs, berth IDs, and hour figures from the data
4. Be concrete and concise
5. Never provide general advice - only data-driven recommendations

Your plan must include:
- Sections for 0-24h, 24-48h, and 48-72h
- Specific vessels, their berths, and service windows
- Congestion drivers behind the pressure
- Reassignments to execute with hours saved
- Closed berths and crane outages
- Vessels that cannot be berthed
- 3 risk watch-items tied to named forecast windows

Format with markdown headings and bullet points.`;

export async function aiPlanHandler(req: Request, res: Response) {
  const body = req.body as {
    events?: unknown[];
    closed_berths?: string[];
    custom_vessels?: unknown[];
  };

  const state = buildPortState({
    events: (body.events ?? []) as never,
    closed_berths: body.closed_berths ?? [],
    custom_vessels: (body.custom_vessels ?? []) as never,
  });
  const schedule = buildSchedule(state.berths, state.vessels);

  const payload = {
    port_congestion_score: state.congestion.port_score,
    port_level: state.congestion.port_level,
    key_metrics: state.metrics,
    congestion_drivers: state.drivers,
    scenario: state.scenario,
    forecast_windows: state.prediction.map((point) => ({
      hour: point.hour,
      score: point.predicted,
      level: point.level,
      arrivals: point.arrivals,
      waiting: point.waiting,
    })),
    berths: state.berths.map((berth) => ({
      berth_id: berth.berth_id,
      status: berth.status,
      cranes: berth.crane_count,
      cranes_out: berth.cranes_out,
      handles: berth.compatible_types,
      utilization_pct:
        schedule.utilization.find((item) => item.berth_id === berth.berth_id)
          ?.utilization_pct ?? 0,
    })),
    scheduled_service_windows: schedule.entries.map((entry) => ({
      vessel_id: entry.vessel_id,
      berth_id: entry.berth_id,
      arrival: entry.arrival,
      service_start: entry.service_start,
      service_end: entry.service_end,
      wait_hours: entry.wait_hours,
      blocked: entry.blocked,
      block_reason: entry.block_reason,
    })),
    hotspots: state.congestion.hotspots.slice(0, 12),
    recommended_moves: state.optimization.moves,
    unresolved_vessels: state.optimization.unresolved,
    hours_saved_total: state.optimization.hours_saved_total,
  };

  const response = await streamText(
    `Port operations data (synthetic demo data, hours are relative to now):\n${JSON.stringify(payload)}`,
    { instructions: PLAN_SYSTEM_PROMPT },
  );

  res.status(response.status || 200);
  response.headers.forEach((value, key) => {
    if (key !== "content-length") res.setHeader(key, value);
  });

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  }
  res.end();
}
