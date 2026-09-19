// Server-side port state assembly.
// Berth infrastructure is fixed (B1-B6 physical specs).
// Vessels come ONLY from user input (CSV import, manual entry, scenario events).
// Auto-assigns unassigned vessels to compatible berths.

import { connectDB, isDBConnected } from "../db.js";
import { VesselModel } from "../../models/vessel.model.js";

const VALID_TYPES = new Set(["Container", "Bulk", "Tanker"]);
const VALID_PRIORITIES = new Set(["standard", "priority"]);

function validateAndMapMongoVessel(rawDoc: any): Vessel | null {
  if (!rawDoc || typeof rawDoc !== "object") return null;
  if (!rawDoc.vessel_id || typeof rawDoc.vessel_id !== "string") return null;
  if (!rawDoc.type || !VALID_TYPES.has(rawDoc.type)) return null;
  if (typeof rawDoc.cargo !== "string") return null;
  if (typeof rawDoc.eta_hours !== "number") return null;
  if (!rawDoc.priority || !VALID_PRIORITIES.has(rawDoc.priority)) return null;

  const type = rawDoc.type as VesselType;
  const defaultUnloadDuration = type === "Container" ? 8 : type === "Bulk" ? 15 : 11;
  const unload_duration_hours =
    typeof rawDoc.unload_duration_hours === "number" && rawDoc.unload_duration_hours > 0
      ? rawDoc.unload_duration_hours
      : defaultUnloadDuration;

  const status: VesselStatus = (
    ["En Route", "Waiting", "Docked"].includes(rawDoc.status)
      ? rawDoc.status
      : rawDoc.eta_hours <= 0
      ? "Docked"
      : "En Route"
  ) as VesselStatus;

  return {
    vessel_id: rawDoc.vessel_id,
    type,
    cargo: rawDoc.cargo,
    eta_hours: rawDoc.eta_hours,
    status,
    assigned_berth_id: rawDoc.assigned_berth_id ?? null,
    unload_duration_hours,
    wait_time_hours: typeof rawDoc.wait_time_hours === "number" ? rawDoc.wait_time_hours : 0,
    priority: rawDoc.priority as VesselPriority,
    delay_reason: rawDoc.delay_reason ?? null,
  };
}
import { buildMetrics, buildSummary, buildYardStatus, detectCongestion } from "./congestion";
import { computeDrivers } from "./drivers";
import { generatePortData, refreshBerthPointers } from "./generator";
import { optimizeAllocation } from "./optimize";
import { predictCongestion } from "./prediction";
import { computeMacroRouting } from "./routing";
import { computeCraneRebalance } from "./crane-pool";
import { effectiveCranes, HORIZON, serviceHours } from "./schedule";
import type {
  Berth,
  PortStatePayload,
  ScenarioEvent,
  ScenarioImpact,
  Vessel,
  VesselType,
  VesselPriority,
} from "./types";

export interface CustomVesselInput {
  vessel_id: string;
  type: VesselType;
  cargo: string;
  eta_hours: number;
  priority: VesselPriority;
}

export interface ScenarioInput {
  events?: ScenarioEvent[];
  closed_berths?: string[];
  custom_vessels?: CustomVesselInput[];
}

/**
 * Auto-assigns vessels to compatible berths using greedy earliest-free-berth.
 * Vessels with assigned_berth_id already set are left alone.
 */
function assignVesselsToBerths(berths: Berth[], vessels: Vessel[]): void {
  const unassigned = vessels.filter((v) => v.assigned_berth_id === null);
  const compatible = berths.filter((b) => b.status !== "closed" && effectiveCranes(b) > 0);

  // Track when each berth becomes free (simple greedy)
  const freeAt: Record<string, number> = {};
  for (const b of compatible) {
    freeAt[b.berth_id] = 0;
  }

  // Sort unassigned by ETA then priority
  unassigned.sort((a, b) => {
    const pa = a.priority === "priority" ? -3 : 0;
    const pb = b.priority === "priority" ? -3 : 0;
    return (a.eta_hours + pa) - (b.eta_hours + pb) || a.vessel_id.localeCompare(b.vessel_id);
  });

  for (const vessel of unassigned) {
    // Find compatible berths
    const options = compatible.filter((b) => b.compatible_types.includes(vessel.type));
    if (options.length === 0) continue;

    // Pick the berth that's free earliest
    let bestBerth = options[0]!;
    let bestFree = freeAt[bestBerth.berth_id] ?? 0;
    for (const b of options) {
      const f = freeAt[b.berth_id] ?? 0;
      if (f < bestFree || (f === bestFree && effectiveCranes(b) > effectiveCranes(bestBerth))) {
        bestFree = f;
        bestBerth = b;
      }
    }

    // Assign vessel to this berth
    vessel.assigned_berth_id = bestBerth.berth_id;

    // Estimate service duration using vessel.unload_duration_hours
    const hours = serviceHours(vessel, bestBerth);

    const start = Math.max(vessel.eta_hours, bestFree);
    freeAt[bestBerth.berth_id] = start + hours;
  }
}

const CLOSURE_REASONS: Record<string, string> = {
  berth_closure: "scheduled maintenance / disruption drill",
};

function applyScenario(
  berths: Berth[],
  vessels: Vessel[],
  events: ScenarioEvent[],
): { affected: string[]; notes: string[] } {
  const affected = new Set<string>();
  const notes: string[] = [];

  for (const event of events) {
    if (event.type === "berth_closure") {
      const berth = berths.find((item) => item.berth_id === event.target);
      if (!berth) continue;
      berth.status = "closed";
      berth.closure_reason = CLOSURE_REASONS["berth_closure"]!;
      berth.closure_end_hour = event.duration_hours;
      berth.current_vessel_id = null;
      // Null out assignments so vessels get reassigned to open berths
      vessels
        .filter((vessel) => vessel.assigned_berth_id === berth.berth_id)
        .forEach((vessel) => {
          vessel.assigned_berth_id = null;
          affected.add(vessel.vessel_id);
        });
      notes.push(`${berth.berth_id} closed for ${event.duration_hours} h.`);
    }

    if (event.type === "berth_reopening") {
      const berth = berths.find((item) => item.berth_id === event.target);
      if (!berth) continue;
      berth.status = "operational";
      berth.closure_reason = null;
      berth.closure_end_hour = null;
      notes.push(`${berth.berth_id} reopened.`);
    }

    if (event.type === "crane_outage") {
      const berth = berths.find((item) => item.berth_id === event.target);
      if (!berth) continue;
      berth.cranes_out = Math.min(berth.crane_count, Math.max(1, event.magnitude));
      if (berth.cranes_out >= berth.crane_count) {
        berth.status = "closed";
        berth.closure_reason = "all cranes out of service";
        berth.current_vessel_id = null;
        // Null out assignments so vessels get reassigned
        vessels
          .filter((vessel) => vessel.assigned_berth_id === berth.berth_id)
          .forEach((vessel) => {
            vessel.assigned_berth_id = null;
            affected.add(vessel.vessel_id);
          });
      } else {
        vessels
          .filter((vessel) => vessel.assigned_berth_id === berth.berth_id)
          .forEach((vessel) => affected.add(vessel.vessel_id));
      }
      notes.push(`${berth.cranes_out} crane(s) down at ${berth.berth_id} for ${event.duration_hours} h.`);
    }

    if (event.type === "vessel_surge") {
      const count = Math.max(1, Math.min(8, event.magnitude));
      const types: VesselType[] = ["Container", "Bulk", "Tanker"];
      for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const vessel: Vessel = {
          vessel_id: `S${Date.now() % 10000 + i}`,
          type,
          cargo: type === "Container" ? "Mixed cargo" : type === "Bulk" ? "Bulk goods" : "Liquid cargo",
          eta_hours: 4 + i * 3,
          status: "En Route",
          assigned_berth_id: null,
          unload_duration_hours: type === "Container" ? 8 : type === "Bulk" ? 12 : 10,
          wait_time_hours: 0,
          priority: "standard",
          delay_reason: "Unscheduled surge arrival",
        };
        vessels.push(vessel);
        affected.add(vessel.vessel_id);
      }
      notes.push(`${count} unscheduled vessels added to the arrival queue.`);
    }

    if (event.type === "severe_weather") {
      for (const vessel of vessels) {
        vessel.unload_duration_hours = Math.round(vessel.unload_duration_hours * 1.3);
        vessel.delay_reason = "Severe weather — reduced handling rate";
        affected.add(vessel.vessel_id);
      }
      notes.push(`Severe weather for ${event.duration_hours} h: handling rates cut by 30%.`);
    }

    if (event.type === "vessel_delay") {
      const vessel = vessels.find((item) => item.vessel_id === event.target);
      if (!vessel) continue;
      vessel.eta_hours += Math.max(1, event.magnitude);
      vessel.delay_reason = `Delayed ${event.magnitude} h en route`;
      affected.add(vessel.vessel_id);
      notes.push(`${vessel.vessel_id} delayed by ${event.magnitude} h.`);
    }
  }

  vessels.sort((a, b) => a.eta_hours - b.eta_hours);
  refreshBerthPointers(berths, vessels);
  return { affected: [...affected], notes };
}

export async function buildPortState(input: ScenarioInput = {}): Promise<PortStatePayload> {
  const events: ScenarioEvent[] = [
    ...(input.events ?? []),
    ...(input.closed_berths ?? []).map((berthId) => ({
      id: `close-${berthId}`,
      type: "berth_closure" as const,
      target: berthId,
      duration_hours: 12,
      magnitude: 1,
    })),
  ];

  // Generate berth infrastructure only — no synthetic vessels
  const baseData = generatePortData();
  const baselineData = {
    berths: baseData.berths.map((b) => ({ ...b })),
    vessels: [] as Vessel[],
    yard: baseData.yard.map((y) => ({ ...y })),
  };
  const baseline = detectCongestion(baselineData.berths, baselineData.vessels);

  const berths = baseData.berths;
  const vessels: Vessel[] = [];
  const yard = baseData.yard;

  // Vessels come from input OR MongoDB database
  if (input.custom_vessels && input.custom_vessels.length > 0) {
    const customVessels: Vessel[] = input.custom_vessels.map((cv) => {
      const unloadDuration = cv.type === "Container" ? 8 : cv.type === "Bulk" ? 15 : 11;
      const status = cv.eta_hours <= 0 ? ("Docked" as const) : ("En Route" as const);
      return {
        vessel_id: cv.vessel_id,
        type: cv.type,
        cargo: cv.cargo,
        eta_hours: cv.eta_hours,
        priority: cv.priority,
        status,
        assigned_berth_id: null,
        unload_duration_hours: unloadDuration,
        wait_time_hours: 0,
        delay_reason: null,
      };
    });
    vessels.push(...customVessels);
  } else {
    // Attempt MongoDB connection
    let connected = isDBConnected();
    if (!connected) {
      connected = await connectDB();
    }

    if (!connected) {
      throw new Error("Unable to load vessels from MongoDB");
    }

    try {
      const dbName = VesselModel.db?.name || "portpredict";
      const collectionName = VesselModel.collection?.name || "vessels";
      const count = await VesselModel.countDocuments({});

      console.log(`[MongoDB] Database: ${dbName}`);
      console.log(`[MongoDB] Collection: ${collectionName}`);
      console.log(`[MongoDB] Vessel count: ${count}`);

      const dbDocs = await VesselModel.find({}).sort({ eta_hours: 1 }).lean();
      console.log(`[MongoDB] Loaded ${dbDocs.length} vessels`);

      const seenIds = new Set<string>();

      for (const doc of dbDocs) {
        if (!doc.vessel_id || seenIds.has(doc.vessel_id)) {
          if (doc.vessel_id) {
            console.warn(`[MongoDB] Duplicate vessel_id skipped: ${doc.vessel_id}`);
          }
          continue;
        }

        const mapped = validateAndMapMongoVessel(doc);
        if (!mapped) {
          console.warn(`[MongoDB] Invalid vessel document skipped: ${JSON.stringify(doc.vessel_id || doc)}`);
          continue;
        }

        seenIds.add(mapped.vessel_id);
        vessels.push(mapped);
      }

      console.log(`[Port State] Scheduling ${vessels.length} vessels`);
    } catch (err) {
      console.error("[MongoDB] Error querying vessels collection:", err);
      throw new Error(`Unable to load vessels from MongoDB: ${(err as Error).message}`);
    }
  }

  // Apply scenario FIRST (closes berths, nulls out affected vessel assignments)
  const { affected } = applyScenario(berths, vessels, events);

  // THEN assign unassigned vessels — skips closed berths
  assignVesselsToBerths(berths, vessels);

  const { result: congestion, vessels: scored, schedule } = detectCongestion(berths, vessels);
  const prediction = predictCongestion(berths, scored);
  const optimization = optimizeAllocation(berths, scored);
  const yardStatus = buildYardStatus(yard);
  const drivers = computeDrivers(berths, scored, schedule, yardStatus);
  const macroRouting = computeMacroRouting(berths, scored, congestion.port_score);
  const craneRebalance = computeCraneRebalance(berths, scored);

  const baselineWait = baseline.vessels.reduce((sum, vessel) => sum + vessel.wait_time_hours, 0);
  const scenarioWait = scored.reduce((sum, vessel) => sum + vessel.wait_time_hours, 0);

  const scenario: ScenarioImpact = {
    events,
    affected_vessel_ids: affected,
    baseline_score: baseline.result.port_score,
    baseline_level: baseline.result.port_level,
    scenario_score: congestion.port_score,
    scenario_level: congestion.port_level,
    added_wait_hours: Math.round((scenarioWait - baselineWait) * 10) / 10,
  };

  return {
    generated_note:
      "Vessel data comes from user input only (CSV import, manual entry). Berth infrastructure (B1-B6) is fixed port config. No synthetic data is generated.",
    berths,
    vessels: scored,
    summary: buildSummary(berths, scored, yard),
    metrics: buildMetrics(berths, scored, schedule),
    congestion,
    prediction,
    drivers,
    optimization,
    scenario,
    closed_berths: berths.filter((berth) => berth.status === "closed").map((berth) => berth.berth_id),
    eta_history: scored.map((vessel) => {
      const original = baselineData.vessels.find((item) => item.vessel_id === vessel.vessel_id);
      const originalEta = original?.eta_hours ?? vessel.eta_hours;
      return {
        vessel_id: vessel.vessel_id,
        original_eta: originalEta,
        current_eta: vessel.eta_hours,
        note: original
          ? originalEta === vessel.eta_hours
            ? "ETA unchanged since the scheduled arrival was filed."
            : `ETA moved ${vessel.eta_hours - originalEta > 0 ? "later" : "earlier"} by ${Math.abs(vessel.eta_hours - originalEta)} h${vessel.delay_reason ? ` — ${vessel.delay_reason}` : ""}.`
          : "Unscheduled arrival added by the active scenario.",
      };
    }),
    yard: yardStatus,
    macro_routing: macroRouting,
    crane_rebalance: craneRebalance,
  };
}
