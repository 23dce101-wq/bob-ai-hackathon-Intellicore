"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// index.ts
var import_config = require("dotenv/config");
var import_express2 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));

// lib/db.ts
var import_mongoose = __toESM(require("mongoose"));
var isConnected = false;
async function connectDB() {
  const uri = process.env["MONGODB_URI"] || "mongodb://localhost:27017/portpredict";
  if (isConnected) {
    return true;
  }
  try {
    import_mongoose.default.set("strictQuery", true);
    await import_mongoose.default.connect(uri, {
      serverSelectionTimeoutMS: 3e3
      // 3s timeout for quick fallback if local mongo is down
    });
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to ${uri}`);
    import_mongoose.default.connection.on("error", (err) => {
      console.error("[MongoDB] Connection error:", err);
      isConnected = false;
    });
    import_mongoose.default.connection.on("disconnected", () => {
      console.warn("[MongoDB] Disconnected from database");
      isConnected = false;
    });
    return true;
  } catch (error) {
    console.warn("[MongoDB] Failed to connect to MongoDB. Operating with fallback in-memory handling.");
    console.warn(`[MongoDB] Error detail: ${error.message}`);
    isConnected = false;
    return false;
  }
}
function isDBConnected() {
  return isConnected && import_mongoose.default.connection.readyState === 1;
}

// models/vessel.model.ts
var import_mongoose2 = __toESM(require("mongoose"));
var VesselSchema = new import_mongoose2.Schema(
  {
    vessel_id: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ["Container", "Bulk", "Tanker"] },
    cargo: { type: String, required: true, default: "General Cargo" },
    eta_hours: { type: Number, required: true, default: 0 },
    status: { type: String, required: true, enum: ["En Route", "Waiting", "Docked"], default: "En Route" },
    assigned_berth_id: { type: String, default: null },
    unload_duration_hours: { type: Number, required: true, default: 8 },
    wait_time_hours: { type: Number, required: true, default: 0 },
    priority: { type: String, required: true, enum: ["standard", "priority"], default: "standard" },
    delay_reason: { type: String, default: null }
  },
  {
    timestamps: true
  }
);
var VesselModel = import_mongoose2.default.models["Vessel"] || import_mongoose2.default.model("Vessel", VesselSchema, "vessels");

// lib/port/schedule.ts
var HORIZON = 72;
function effectiveCranes(berth) {
  return Math.max(0, berth.crane_count - (berth.cranes_out ?? 0));
}
function reopenHour(berth) {
  if (effectiveCranes(berth) <= 0) return HORIZON;
  if (berth.status !== "closed") return 0;
  const end = berth.closure_end_hour;
  return end === null || end >= HORIZON ? HORIZON : Math.max(0, end);
}
function berthUsable(berth) {
  return reopenHour(berth) < HORIZON;
}
function berthUsableNow(berth) {
  return reopenHour(berth) <= 0;
}
function compatible(berth, vessel) {
  return berth.compatible_types.includes(vessel.type);
}
function serviceHours(vessel, berth) {
  let hours = vessel.unload_duration_hours;
  if (vessel.type === "Container" && berth.yard_saturation_pct) {
    if (berth.yard_saturation_pct >= 85) {
      hours = Math.round(hours * 1.25);
    } else if (berth.yard_saturation_pct >= 75) {
      hours = Math.round(hours * 1.1);
    }
  }
  return Math.max(2, hours);
}
function queueKey(vessel) {
  return vessel.eta_hours - (vessel.priority === "priority" ? 3 : 0);
}
function buildSchedule(berths, vessels) {
  const entries = [];
  const utilization = [];
  for (const berth of berths) {
    const reopen = reopenHour(berth);
    const usable = reopen < HORIZON;
    const cranes = effectiveCranes(berth);
    const queue = vessels.filter((vessel) => vessel.assigned_berth_id === berth.berth_id).sort((a, b) => queueKey(a) - queueKey(b) || a.vessel_id.localeCompare(b.vessel_id));
    let freeAt = reopen;
    let busy = 0;
    for (const vessel of queue) {
      const hours = serviceHours(vessel, berth);
      if (!usable) {
        entries.push({
          vessel_id: vessel.vessel_id,
          berth_id: berth.berth_id,
          type: vessel.type,
          priority: vessel.priority,
          arrival: vessel.eta_hours,
          service_start: null,
          service_end: null,
          service_hours: hours,
          wait_hours: HORIZON,
          cranes_assigned: 0,
          blocked: true,
          block_reason: berth.status === "closed" ? `${berth.berth_id} is closed for the whole 72 h window${berth.closure_reason ? ` \u2014 ${berth.closure_reason}` : ""}` : `${berth.berth_id} has no working cranes`
        });
        continue;
      }
      if (!compatible(berth, vessel)) {
        entries.push({
          vessel_id: vessel.vessel_id,
          berth_id: berth.berth_id,
          type: vessel.type,
          priority: vessel.priority,
          arrival: vessel.eta_hours,
          service_start: null,
          service_end: null,
          service_hours: hours,
          wait_hours: HORIZON,
          cranes_assigned: 0,
          blocked: true,
          block_reason: `${berth.berth_id} cannot handle ${vessel.type} vessels`
        });
        continue;
      }
      const start = Math.max(vessel.eta_hours, freeAt);
      const end = start + hours;
      entries.push({
        vessel_id: vessel.vessel_id,
        berth_id: berth.berth_id,
        type: vessel.type,
        priority: vessel.priority,
        arrival: vessel.eta_hours,
        service_start: Math.round(start * 10) / 10,
        service_end: Math.round(end * 10) / 10,
        service_hours: hours,
        wait_hours: Math.round(Math.max(0, start - vessel.eta_hours) * 10) / 10,
        cranes_assigned: Math.min(cranes, vessel.type === "Container" ? cranes : 2),
        blocked: false,
        block_reason: null
      });
      busy += Math.max(0, Math.min(end, HORIZON) - Math.max(start, 0));
      freeAt = end;
    }
    const available = usable ? HORIZON - reopen : 0;
    utilization.push({
      berth_id: berth.berth_id,
      busy_hours: Math.round(busy * 10) / 10,
      available_hours: available,
      utilization_pct: available ? Math.min(100, Math.round(busy / available * 100)) : 0
    });
  }
  for (const vessel of vessels.filter((item) => item.assigned_berth_id === null)) {
    entries.push({
      vessel_id: vessel.vessel_id,
      berth_id: null,
      type: vessel.type,
      priority: vessel.priority,
      arrival: vessel.eta_hours,
      service_start: null,
      service_end: null,
      service_hours: vessel.unload_duration_hours,
      wait_hours: HORIZON,
      cranes_assigned: 0,
      blocked: true,
      block_reason: "No compatible berth assigned"
    });
  }
  const totalBusy = utilization.reduce((sum, item) => sum + item.busy_hours, 0);
  const totalAvailable = utilization.reduce((sum, item) => sum + item.available_hours, 0);
  return {
    entries,
    utilization,
    port_utilization_pct: totalAvailable ? Math.min(100, Math.round(totalBusy / totalAvailable * 100)) : 0
  };
}
function waitingAt(schedule, hour) {
  return schedule.entries.filter(
    (entry) => entry.arrival <= hour && (entry.service_start === null || entry.service_start > hour) && (entry.service_end === null || entry.service_end > hour)
  );
}
function berthedAt(schedule, hour) {
  return schedule.entries.filter(
    (entry) => entry.service_start !== null && entry.service_end !== null && entry.service_start <= hour && entry.service_end > hour
  );
}

// lib/port/congestion.ts
function levelFromScore(score) {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 28) return "medium";
  return "low";
}
function severityFromOverlap(hours) {
  if (hours >= 16) return "critical";
  if (hours >= 10) return "high";
  if (hours >= 4) return "medium";
  return "low";
}
function detectCongestion(berths, vessels, windowStart = -Infinity, windowEnd = Infinity) {
  const updated = vessels.map((vessel) => ({ ...vessel, wait_time_hours: 0 }));
  const schedule = buildSchedule(berths, updated);
  const hotspots = [];
  for (const entry of schedule.entries) {
    const vessel = updated.find((item) => item.vessel_id === entry.vessel_id);
    if (!vessel) continue;
    if (entry.blocked) {
      const berth = entry.berth_id ? berths.find((b) => b.berth_id === entry.berth_id) : null;
      const reopenHour2 = berth ? berth.status === "closed" ? berth.closure_end_hour ?? 72 : berth.cranes_out > 0 ? 12 : 0 : 24;
      vessel.wait_time_hours = Math.max(entry.wait_hours, reopenHour2);
      vessel.status = "Waiting";
    } else {
      vessel.wait_time_hours = entry.wait_hours;
      const start = entry.service_start ?? 0;
      const end = entry.service_end ?? 0;
      vessel.status = start <= 0 && end > 0 ? "Docked" : entry.wait_hours > 0 ? "Waiting" : "En Route";
    }
    const inWindow = entry.arrival >= windowStart && entry.arrival < windowEnd;
    if (!inWindow) continue;
    if (entry.blocked) {
      hotspots.push({
        berth_id: entry.berth_id ?? "\u2014",
        vessel_id: entry.vessel_id,
        eta_hours: entry.arrival,
        berth_free_at: Number.POSITIVE_INFINITY,
        overlap_hours: vessel.wait_time_hours,
        severity: "critical",
        reason: entry.block_reason ?? "Vessel cannot be serviced"
      });
    } else if (entry.wait_hours > 0) {
      hotspots.push({
        berth_id: entry.berth_id ?? "\u2014",
        vessel_id: entry.vessel_id,
        eta_hours: entry.arrival,
        berth_free_at: entry.service_start ?? 0,
        overlap_hours: entry.wait_hours,
        severity: severityFromOverlap(entry.wait_hours),
        reason: `Arrives +${entry.arrival}h but ${entry.berth_id} is busy until +${entry.service_start}h`
      });
    }
  }
  const berthStats = berths.map((berth) => {
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
        level: entries.length ? "critical" : "medium"
      };
    }
    const delayed = entries.filter(
      (entry) => entry.wait_hours > 0 && entry.arrival >= windowStart && entry.arrival < windowEnd
    );
    const avgWait = delayed.length ? delayed.reduce((sum, entry) => sum + entry.wait_hours, 0) / delayed.length : 0;
    const craneFactor = 3 / Math.max(1, effectiveCranes(berth));
    const raw = delayed.length * avgWait * craneFactor * 1.6 + Math.max(0, utilization - 85) * 0.9;
    return {
      berth_id: berth.berth_id,
      overlap_count: delayed.length,
      avg_wait_hours: Math.round(avgWait * 10) / 10,
      utilization_pct: utilization,
      score: Math.min(100, Math.round(raw)),
      level: levelFromScore(Math.min(100, raw))
    };
  });
  const portScore = berthStats.length ? Math.min(
    100,
    Math.round(berthStats.reduce((sum, item) => sum + item.score, 0) / berthStats.length)
  ) : 0;
  return {
    result: {
      hotspots: hotspots.sort((a, b) => b.overlap_hours - a.overlap_hours),
      berths: berthStats,
      port_score: portScore,
      port_level: levelFromScore(portScore)
    },
    vessels: updated,
    schedule
  };
}
function buildSummary(berths, vessels, yard) {
  const totalT = yard.reduce((s, b) => s + b.total_teu, 0);
  const usedT = yard.reduce((s, b) => s + b.used_teu, 0);
  return {
    total_berths: berths.length,
    operational_berths: berths.filter(berthUsableNow).length,
    total_cranes: berths.reduce((sum, berth) => sum + berth.crane_count, 0),
    available_cranes: berths.filter((berth) => berth.status === "operational").reduce((sum, berth) => sum + effectiveCranes(berth), 0),
    vessels_in_port: vessels.filter((vessel) => vessel.status === "Docked").length,
    vessels_waiting: vessels.filter((vessel) => vessel.status === "Waiting").length,
    yard_utilization_pct: totalT ? Math.round(usedT / totalT * 100) : 0,
    yard_saturation_blocks: yard.filter((b) => b.used_teu / b.total_teu >= 0.9).length
  };
}
function buildMetrics(berths, vessels, schedule) {
  const waits = vessels.map((vessel) => vessel.wait_time_hours);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
  const turnarounds = schedule.entries.map(
    (entry) => entry.service_hours + (entry.blocked ? 24 : entry.wait_hours)
  );
  const avgTurnaround = turnarounds.length ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0;
  return {
    avg_wait_hours: Math.round(avgWait * 10) / 10,
    avg_turnaround_hours: Math.round(avgTurnaround * 10) / 10,
    berth_utilization_pct: schedule.port_utilization_pct,
    delayed_vessel_count: vessels.filter((vessel) => vessel.wait_time_hours > 0).length,
    metric_note: `Berth utilisation = busy berth-hours / available berth-hours across the next ${HORIZON} h. Wait and turnaround are averaged over all scheduled vessels.`
  };
}
function buildYardStatus(blocks) {
  const totalT = blocks.reduce((s, b) => s + b.total_teu, 0);
  const usedT = blocks.reduce((s, b) => s + b.used_teu, 0);
  const saturated = blocks.filter((b) => b.used_teu / b.total_teu >= 0.9).length;
  const operationalRtgs = blocks.filter((b) => b.rtg_operational).reduce((s, b) => s + b.rtg_count, 0);
  const totalRtgs = blocks.reduce((s, b) => s + b.rtg_count, 0);
  const utilPct = totalT ? Math.round(usedT / totalT * 100) : 0;
  let level = "low";
  if (utilPct >= 90 || saturated >= 2) level = "critical";
  else if (utilPct >= 75 || saturated >= 1) level = "high";
  else if (utilPct >= 55) level = "medium";
  return {
    blocks,
    total_teu: totalT,
    used_teu: usedT,
    utilization_pct: utilPct,
    saturated_blocks: saturated,
    rtg_availability_pct: totalRtgs ? Math.round(operationalRtgs / totalRtgs * 100) : 0,
    level
  };
}

// lib/port/drivers.ts
function computeDrivers(berths, vessels, schedule = buildSchedule(berths, vessels), yard) {
  const drivers = [];
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
    weight: Math.min(100, Math.round(demandRatio * 26))
  });
  if (closed.length) {
    drivers.push({
      title: `${closed.length} berth${closed.length > 1 ? "s" : ""} out of service`,
      detail: `${closed.map((berth) => berth.berth_id).join(", ")} closed${closed[0]?.closure_reason ? ` \u2014 ${closed[0].closure_reason}` : ""}, removing ${closed.reduce((sum, berth) => sum + berth.crane_count, 0)} cranes from the plan.`,
      weight: Math.min(100, closed.length * 30)
    });
  }
  if (craneShort.length) {
    const lost = craneShort.reduce((sum, berth) => sum + berth.cranes_out, 0);
    drivers.push({
      title: "Crane outage slowing handling",
      detail: `${lost} crane${lost > 1 ? "s" : ""} down at ${craneShort.map((berth) => berth.berth_id).join(", ")}, stretching unload times at those berths.`,
      weight: Math.min(100, lost * 18)
    });
  }
  const busiest = [...schedule.utilization].filter((item) => item.available_hours > 0).sort((a, b) => b.utilization_pct - a.utilization_pct)[0];
  if (busiest) {
    drivers.push({
      title: `${busiest.berth_id} is the tightest berth`,
      detail: `Booked ${busiest.busy_hours} h of ${busiest.available_hours} h (${busiest.utilization_pct}% utilised) over the ${HORIZON} h window.`,
      weight: busiest.utilization_pct
    });
  }
  if (stranded.length) {
    drivers.push({
      title: "Vessels with nowhere to berth",
      detail: `${stranded.length} vessel${stranded.length > 1 ? "s" : ""} cannot be serviced as scheduled: ${stranded.slice(0, 4).map((entry) => entry.vessel_id).join(", ")}.`,
      weight: Math.min(100, stranded.length * 22)
    });
  }
  if (priorityDelayed.length) {
    drivers.push({
      title: "Priority vessels queued behind others",
      detail: `${priorityDelayed.map((entry) => entry.vessel_id).join(", ")} carry priority cargo but still wait for a free berth.`,
      weight: Math.min(100, priorityDelayed.length * 24)
    });
  }
  const lowCrane = usable.filter((berth) => effectiveCranes(berth) <= 2);
  if (lowCrane.length) {
    drivers.push({
      title: "Low-crane berths handle cargo slowly",
      detail: `${lowCrane.map((berth) => `${berth.berth_id} (${effectiveCranes(berth)} cranes)`).join(", ")} take roughly ${Math.round(3 / Math.max(1, effectiveCranes(lowCrane[0])) * 100 - 100)}% longer per vessel than a 3-crane berth.`,
      weight: Math.min(100, lowCrane.length * 14)
    });
  }
  if (yard) {
    if (yard.saturated_blocks > 0) {
      drivers.push({
        title: `${yard.saturated_blocks} yard block${yard.saturated_blocks > 1 ? "s" : ""} at or above 90% saturation`,
        detail: `${yard.used_teu} of ${yard.total_teu} TEU slots occupied (${yard.utilization_pct}%). Saturated blocks cause delayed container retrieval and truck congestion.`,
        weight: Math.min(100, yard.saturated_blocks * 28)
      });
    }
    if (yard.rtg_availability_pct < 80) {
      drivers.push({
        title: "Yard crane (RTG) availability low",
        detail: `Only ${yard.rtg_availability_pct}% of rubber-tyred gantry cranes operational across yard blocks, slowing container stacking and retrieval.`,
        weight: Math.min(100, (100 - yard.rtg_availability_pct) * 1.2)
      });
    }
    if (yard.utilization_pct >= 75) {
      drivers.push({
        title: "Container yard nearing capacity",
        detail: `Yard at ${yard.utilization_pct}% capacity. High yard occupancy increases truck turnaround time and can block vessel unloading.`,
        weight: Math.min(100, Math.round((yard.utilization_pct - 60) * 2.5))
      });
    }
  }
  return drivers.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

// lib/port/generator.ts
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var BERTH_SPEC = {
  B1: { cranes: 4, length_m: 350, types: ["Container", "Bulk"] },
  B2: { cranes: 3, length_m: 300, types: ["Container"] },
  B3: { cranes: 5, length_m: 400, types: ["Container", "Bulk", "Tanker"] },
  B4: { cranes: 2, length_m: 240, types: ["Bulk", "Tanker"] },
  B5: { cranes: 3, length_m: 280, types: ["Container", "Tanker"] },
  B6: { cranes: 4, length_m: 330, types: ["Container", "Bulk"] }
};
var YARD_BLOCK_SPEC = [
  { block_id: "Y1", total_teu: 4200, serving_berths: ["B1", "B2"] },
  { block_id: "Y2", total_teu: 3800, serving_berths: ["B3", "B4"] },
  { block_id: "Y3", total_teu: 4500, serving_berths: ["B5", "B6"] },
  { block_id: "Y4", total_teu: 3200, serving_berths: ["B1", "B6"] }
];
function makeYardBlocks(rand, vesselCount) {
  const baselinePcts = [0.32, 0.18, 0.45, 0.25];
  return YARD_BLOCK_SPEC.map((spec, i) => {
    const used = Math.round(spec.total_teu * baselinePcts[i]);
    const reserved = 0;
    const rtgCount = Math.ceil(spec.total_teu / 1200);
    return {
      block_id: spec.block_id,
      total_teu: spec.total_teu,
      used_teu: used,
      reserved_teu: reserved,
      rtg_count: rtgCount,
      rtg_operational: true,
      serving_berths: spec.serving_berths
    };
  });
}
function makeBerths() {
  return Object.entries(BERTH_SPEC).map(([id, spec]) => {
    const yardBlock = YARD_BLOCK_SPEC.find((block) => block.serving_berths.includes(id));
    return {
      berth_id: id,
      status: "operational",
      crane_count: spec.cranes,
      cranes_out: 0,
      current_vessel_id: null,
      next_vessel_eta: null,
      closure_reason: null,
      closure_end_hour: null,
      length_m: spec.length_m,
      compatible_types: spec.types,
      yard_block_id: yardBlock?.block_id ?? null,
      yard_saturation_pct: 0
    };
  });
}
function refreshBerthPointers(berths, vessels) {
  for (const berth of berths) {
    const queue = vessels.filter((vessel) => vessel.assigned_berth_id === berth.berth_id).sort((a, b) => a.eta_hours - b.eta_hours);
    const docked = queue.find((vessel) => vessel.eta_hours <= 0);
    berth.current_vessel_id = berth.status === "closed" ? null : docked?.vessel_id ?? null;
    const next = queue.find((vessel) => vessel.eta_hours > 0);
    berth.next_vessel_eta = next ? next.eta_hours : null;
  }
}
function generatePortData() {
  const berths = makeBerths();
  const vessels = [];
  const rand = rng(Date.now());
  const yard = makeYardBlocks(rand, 0);
  for (const berth of berths) {
    const block = yard.find((b) => b.block_id === berth.yard_block_id);
    berth.yard_saturation_pct = block ? Math.round(block.used_teu / block.total_teu * 100) : 0;
  }
  return { berths, vessels, yard };
}

// lib/port/optimize.ts
function berthFreeAt(berth, berths, vessels, ignoreVesselId) {
  const trimmed = vessels.filter((vessel) => vessel.vessel_id !== ignoreVesselId);
  const schedule = buildSchedule(berths, trimmed);
  const ends = schedule.entries.filter((entry) => entry.berth_id === berth.berth_id && entry.service_end !== null).map((entry) => entry.service_end);
  return ends.length ? Math.max(...ends) : 0;
}
function computeRoutingStrategies(vessels, berths) {
  const strategies = [];
  for (const vessel of vessels) {
    const baseSpeed = vessel.type === "Container" ? 19.5 : vessel.type === "Bulk" ? 14 : 15;
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
        rationale: "Vessel is actively alongside berth and discharging cargo."
      });
      continue;
    }
    if (wait >= 24) {
      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "inter_terminal_divert",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: 13,
        speed_reduction_pct: Math.round((baseSpeed - 13) / baseSpeed * 100),
        fuel_saved_tons: 14.2,
        co2_saved_tons: 44.2,
        anchorage_zone: "Fairway Staging Zone Delta",
        diversion_terminal: "South Harbor Pier 400 (Alternate Terminal)",
        holding_hours: wait,
        rationale: `Extreme wait of ${wait}h exceeds commercial demurrage threshold. Advise inter-terminal diversion to regional partner facility.`
      });
    } else if (wait >= 10) {
      const anchorZone = vessel.type === "Container" ? "Anchorage Area Bravo (Deep Water Outer)" : "Anchorage Area Charlie (General Anchorage)";
      strategies.push({
        vessel_id: vessel.vessel_id,
        action: "anchorage_holding",
        original_speed_knots: baseSpeed,
        advisory_speed_knots: 12,
        speed_reduction_pct: Math.round((baseSpeed - 12) / baseSpeed * 100),
        fuel_saved_tons: Math.round(wait * 0.45 * 10) / 10,
        co2_saved_tons: Math.round(wait * 0.45 * 3.114 * 10) / 10,
        anchorage_zone: anchorZone,
        diversion_terminal: null,
        holding_hours: wait,
        rationale: `Hold in designated offshore anchorage ${anchorZone} to keep main channel unobstructed until scheduled pilot window at +${Math.round((eta + wait) * 10) / 10}h.`
      });
    } else if (wait >= 3 && eta > 4) {
      const ratio = eta / (eta + wait);
      const targetSpeed = Math.max(11.5, Math.round(baseSpeed * ratio * 10) / 10);
      const reduction = Math.round((baseSpeed - targetSpeed) / baseSpeed * 100);
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
        rationale: `Slow-steam speed advisory: reduce cruising speed from ${baseSpeed} kts to ${targetSpeed} kts (${reduction}% cut). Arrives JIT when berth frees up, eliminating offshore idle time, saving ${fuelSaved}t bunker fuel and ${co2Saved}t CO2.`
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
        rationale: "Berth window clear on arrival. Maintain scheduled cruising speed for immediate pilot boarding."
      });
    }
  }
  return strategies;
}
function optimizeAllocation(berths, vessels) {
  const before = detectCongestion(berths, vessels);
  const workingVessels = before.vessels.map((vessel) => ({ ...vessel }));
  const workingBerths = berths.map((berth) => ({ ...berth }));
  const moves = [];
  const unresolved = [];
  const craneTransfers = [];
  const initialSchedule = buildSchedule(workingBerths, workingVessels);
  const idleBerth = workingBerths.find(
    (b) => b.status === "operational" && effectiveCranes(b) >= 2 && (initialSchedule.utilization.find((u) => u.berth_id === b.berth_id)?.utilization_pct ?? 0) < 35
  );
  const congestedBerth = workingBerths.find(
    (b) => b.status === "operational" && b.compatible_types.includes("Container") && effectiveCranes(b) < 6 && (initialSchedule.utilization.find((u) => u.berth_id === b.berth_id)?.utilization_pct ?? 0) > 70
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
      rationale: `Shifted 1 mobile STS crane gang from low-demand ${idleBerth.berth_id} to heavily backlogged container quay ${congestedBerth.berth_id} to accelerate container discharge rate.`
    });
  }
  const openBerths = workingBerths.filter(berthUsable);
  const overflow = [...before.result.hotspots].sort((a, b) => b.overlap_hours - a.overlap_hours);
  for (const hotspot of overflow) {
    const vessel = workingVessels.find((item) => item.vessel_id === hotspot.vessel_id);
    if (!vessel || vessel.status === "Docked") continue;
    const currentBerthId = vessel.assigned_berth_id;
    const waitBefore = vessel.wait_time_hours;
    let bestBerth = null;
    let bestFree = Number.POSITIVE_INFINITY;
    for (const berth of openBerths) {
      if (berth.berth_id === currentBerthId) continue;
      if (!compatible(berth, vessel)) continue;
      const free = berthFreeAt(berth, workingBerths, workingVessels, vessel.vessel_id);
      const better = free < bestFree || free === bestFree && bestBerth !== null && effectiveCranes(berth) > effectiveCranes(bestBerth);
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
        currentBerthId ? `${currentBerthId} cannot take ${vessel.vessel_id}: ${hotspot.reason}.` : `${vessel.vessel_id} had no compatible berth assigned.`,
        `${bestBerth.berth_id} frees at +${Math.round(bestFree * 10) / 10}h and handles ${vessel.type} cargo.`,
        `${cranes} cranes there unload ${vessel.cargo} in about ${hours} h, cutting the wait from ${waitBefore} h to ${waitAfter} h.`
      ]
    });
  }
  const after = detectCongestion(workingBerths, workingVessels);
  const routingStrategies = computeRoutingStrategies(after.vessels, workingBerths);
  const totalFuelSaved = Math.round(
    routingStrategies.reduce((sum, r) => sum + r.fuel_saved_tons, 0) * 10
  ) / 10;
  const totalCo2Saved = Math.round(
    routingStrategies.reduce((sum, r) => sum + r.co2_saved_tons, 0) * 10
  ) / 10;
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
    co2_saved_total_tons: totalCo2Saved
  };
}

// lib/port/prediction.ts
var STEP = 6;
var HORIZON2 = 72;
function predictCongestion(berths, vessels) {
  const schedule = buildSchedule(berths, vessels);
  const usable = berths.filter(berthUsable);
  const closedCount = berths.length - usable.length;
  const points = [];
  let prev = 0;
  for (let hour = 0; hour <= HORIZON2; hour += STEP) {
    const arrivals = vessels.filter(
      (vessel) => vessel.eta_hours >= hour && vessel.eta_hours < hour + STEP
    ).length;
    const waiting = waitingAt(schedule, hour).length;
    const berthed = berthedAt(schedule, hour).length;
    const raw = Math.min(
      100,
      waiting / Math.max(1, usable.length) * 30 + arrivals * 5 + closedCount * 14
    );
    const score = Math.round(prev * 0.35 + raw * 0.65);
    prev = score;
    const level = levelFromScore(score);
    points.push({
      hour,
      label: `+${hour}h`,
      current: hour <= 12 ? score : null,
      // "observed" portion of the series
      predicted: score,
      level,
      arrivals,
      waiting,
      berthed,
      usable_berths: usable.length,
      drivers: [
        `${arrivals} arrival${arrivals === 1 ? "" : "s"} in window`,
        `${waiting} vessel${waiting === 1 ? "" : "s"} queueing`,
        `${berthed} berth${berthed === 1 ? "" : "s"} working`,
        closedCount ? `${closedCount} berth${closedCount > 1 ? "s" : ""} out of service` : "full capacity"
      ]
    });
  }
  return points;
}

// lib/port/routing.ts
var SECONDARY_PORTS = ["Port Alpha (38 nm east)", "Port Beta (52 nm north)"];
function seededValue(seed) {
  let a = seed | 0;
  a = a + 1831565813 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function computeMacroRouting(berths, vessels, portCongestionScore) {
  const advice = [];
  const incoming = vessels.filter(
    (v) => v.eta_hours > 4 && v.status !== "Docked" && v.assigned_berth_id !== null
  );
  for (let i = 0; i < incoming.length; i++) {
    const vessel = incoming[i];
    const assignedBerth = berths.find((b) => b.berth_id === vessel.assigned_berth_id);
    if (!assignedBerth) continue;
    const deterministicRand = seededValue(i * 1e3 + portCongestionScore);
    const berthCongested = assignedBerth.status === "closed" || assignedBerth.cranes_out >= assignedBerth.crane_count;
    if (portCongestionScore >= 75 || berthCongested) {
      const delayHours = Math.min(8, Math.round(portCongestionScore / 12));
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "slow_steaming",
        detail: `Reduce speed to arrive +${delayHours}h later. This lets ${assignedBerth.berth_id} clear the current backlog and avoids anchorage waiting.`,
        fuel_savings_kg: Math.round(delayHours * 45 + deterministicRand * 120),
        time_impact_hours: delayHours,
        target_port: null
      });
    }
    if (portCongestionScore >= 85 && vessel.type !== "Tanker") {
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "offshore_holding",
        detail: `Hold at designated offshore anchorage (4 nm south) until congestion drops below critical. Estimated hold: ${Math.round(portCongestionScore / 15)}h.`,
        fuel_savings_kg: null,
        time_impact_hours: Math.round(portCongestionScore / 15),
        target_port: null
      });
    }
    if (portCongestionScore >= 90 && vessel.type === "Bulk") {
      const target = SECONDARY_PORTS[Math.floor(deterministicRand * SECONDARY_PORTS.length)];
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "divert_secondary_port",
        detail: `Divert to ${target}. ${assignedBerth.berth_id} is critically congested and Bulk cargo can be handled at the secondary facility.`,
        fuel_savings_kg: null,
        time_impact_hours: -2,
        target_port: target
      });
    }
    if (vessel.eta_hours > 24 && vessel.eta_hours < 48) {
      advice.push({
        vessel_id: vessel.vessel_id,
        strategy: "advance_booking",
        detail: `Pre-book ${assignedBerth.berth_id} service window for +${vessel.eta_hours}h arrival to guarantee priority handling.`,
        fuel_savings_kg: null,
        time_impact_hours: 0,
        target_port: null
      });
    }
  }
  return advice.sort((a, b) => {
    const order = { divert_secondary_port: 0, slow_steaming: 1, offshore_holding: 2, advance_booking: 3 };
    return (order[a.strategy] ?? 4) - (order[b.strategy] ?? 4);
  });
}

// lib/port/crane-pool.ts
function computeCraneRebalance(berths, vessels) {
  const moves = [];
  const schedule = buildSchedule(berths, vessels);
  const usableBerths = berths.filter(berthUsable);
  for (const targetBerth of usableBerths) {
    const targetEntries = schedule.entries.filter(
      (e) => e.berth_id === targetBerth.berth_id
    );
    const targetDelayed = targetEntries.filter((e) => e.wait_hours > 0);
    const targetUtil = targetEntries.length > 0 ? targetEntries.reduce((s, e) => s + e.service_hours, 0) / 72 * 100 : 0;
    if (targetDelayed.length < 2 || targetUtil < 60) continue;
    for (const sourceBerth of usableBerths) {
      if (sourceBerth.berth_id === targetBerth.berth_id) continue;
      const sourceEntries = schedule.entries.filter(
        (e) => e.berth_id === sourceBerth.berth_id
      );
      const sourceBusy = sourceEntries.filter(
        (e) => e.service_start !== null && e.service_end !== null
      );
      const sourceCranes = effectiveCranes(sourceBerth);
      const sourceIdleHours = 72 - sourceBusy.reduce((s, e) => s + e.service_hours, 0);
      const cranesSurplus = Math.max(0, sourceCranes - 2);
      if (cranesSurplus < 1 || sourceIdleHours < 12) continue;
      const cranesToMove = Math.min(cranesSurplus, 2);
      const congestionReduction = Math.min(30, targetDelayed.length * 5 + cranesToMove * 8);
      moves.push({
        from_berth_id: sourceBerth.berth_id,
        to_berth_id: targetBerth.berth_id,
        cranes_moved: cranesToMove,
        reason: `${sourceBerth.berth_id} has ${sourceCranes} cranes but only ${sourceBusy.length} vessels queued. ${targetBerth.berth_id} has ${targetDelayed.length} delayed vessels needing faster turnaround.`,
        congestion_reduction_estimate: congestionReduction
      });
      break;
    }
  }
  return moves.sort((a, b) => b.congestion_reduction_estimate - a.congestion_reduction_estimate);
}

// lib/port/state.server.ts
var VALID_TYPES = /* @__PURE__ */ new Set(["Container", "Bulk", "Tanker"]);
var VALID_PRIORITIES = /* @__PURE__ */ new Set(["standard", "priority"]);
function validateAndMapMongoVessel(rawDoc) {
  if (!rawDoc || typeof rawDoc !== "object") return null;
  if (!rawDoc.vessel_id || typeof rawDoc.vessel_id !== "string") return null;
  if (!rawDoc.type || !VALID_TYPES.has(rawDoc.type)) return null;
  if (typeof rawDoc.cargo !== "string") return null;
  if (typeof rawDoc.eta_hours !== "number") return null;
  if (!rawDoc.priority || !VALID_PRIORITIES.has(rawDoc.priority)) return null;
  const type = rawDoc.type;
  const defaultUnloadDuration = type === "Container" ? 8 : type === "Bulk" ? 15 : 11;
  const unload_duration_hours = typeof rawDoc.unload_duration_hours === "number" && rawDoc.unload_duration_hours > 0 ? rawDoc.unload_duration_hours : defaultUnloadDuration;
  const status = ["En Route", "Waiting", "Docked"].includes(rawDoc.status) ? rawDoc.status : rawDoc.eta_hours <= 0 ? "Docked" : "En Route";
  return {
    vessel_id: rawDoc.vessel_id,
    type,
    cargo: rawDoc.cargo,
    eta_hours: rawDoc.eta_hours,
    status,
    assigned_berth_id: rawDoc.assigned_berth_id ?? null,
    unload_duration_hours,
    wait_time_hours: typeof rawDoc.wait_time_hours === "number" ? rawDoc.wait_time_hours : 0,
    priority: rawDoc.priority,
    delay_reason: rawDoc.delay_reason ?? null
  };
}
function assignVesselsToBerths(berths, vessels) {
  const unassigned = vessels.filter((v) => v.assigned_berth_id === null);
  const compatible2 = berths.filter((b) => b.status !== "closed" && effectiveCranes(b) > 0);
  const freeAt = {};
  for (const b of compatible2) {
    freeAt[b.berth_id] = 0;
  }
  unassigned.sort((a, b) => {
    const pa = a.priority === "priority" ? -3 : 0;
    const pb = b.priority === "priority" ? -3 : 0;
    return a.eta_hours + pa - (b.eta_hours + pb) || a.vessel_id.localeCompare(b.vessel_id);
  });
  for (const vessel of unassigned) {
    const options = compatible2.filter((b) => b.compatible_types.includes(vessel.type));
    if (options.length === 0) continue;
    let bestBerth = options[0];
    let bestFree = freeAt[bestBerth.berth_id] ?? 0;
    for (const b of options) {
      const f = freeAt[b.berth_id] ?? 0;
      if (f < bestFree || f === bestFree && effectiveCranes(b) > effectiveCranes(bestBerth)) {
        bestFree = f;
        bestBerth = b;
      }
    }
    vessel.assigned_berth_id = bestBerth.berth_id;
    const hours = serviceHours(vessel, bestBerth);
    const start = Math.max(vessel.eta_hours, bestFree);
    freeAt[bestBerth.berth_id] = start + hours;
  }
}
var CLOSURE_REASONS = {
  berth_closure: "scheduled maintenance / disruption drill"
};
function applyScenario(berths, vessels, events) {
  const affected = /* @__PURE__ */ new Set();
  const notes = [];
  for (const event of events) {
    if (event.type === "berth_closure") {
      const berth = berths.find((item) => item.berth_id === event.target);
      if (!berth) continue;
      berth.status = "closed";
      berth.closure_reason = CLOSURE_REASONS["berth_closure"];
      berth.closure_end_hour = event.duration_hours;
      berth.current_vessel_id = null;
      vessels.filter((vessel) => vessel.assigned_berth_id === berth.berth_id).forEach((vessel) => {
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
        vessels.filter((vessel) => vessel.assigned_berth_id === berth.berth_id).forEach((vessel) => {
          vessel.assigned_berth_id = null;
          affected.add(vessel.vessel_id);
        });
      } else {
        vessels.filter((vessel) => vessel.assigned_berth_id === berth.berth_id).forEach((vessel) => affected.add(vessel.vessel_id));
      }
      notes.push(`${berth.cranes_out} crane(s) down at ${berth.berth_id} for ${event.duration_hours} h.`);
    }
    if (event.type === "vessel_surge") {
      const count = Math.max(1, Math.min(8, event.magnitude));
      const types = ["Container", "Bulk", "Tanker"];
      for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const vessel = {
          vessel_id: `S${Date.now() % 1e4 + i}`,
          type,
          cargo: type === "Container" ? "Mixed cargo" : type === "Bulk" ? "Bulk goods" : "Liquid cargo",
          eta_hours: 4 + i * 3,
          status: "En Route",
          assigned_berth_id: null,
          unload_duration_hours: type === "Container" ? 8 : type === "Bulk" ? 12 : 10,
          wait_time_hours: 0,
          priority: "standard",
          delay_reason: "Unscheduled surge arrival"
        };
        vessels.push(vessel);
        affected.add(vessel.vessel_id);
      }
      notes.push(`${count} unscheduled vessels added to the arrival queue.`);
    }
    if (event.type === "severe_weather") {
      for (const vessel of vessels) {
        vessel.unload_duration_hours = Math.round(vessel.unload_duration_hours * 1.3);
        vessel.delay_reason = "Severe weather \u2014 reduced handling rate";
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
async function buildPortState(input = {}) {
  const events = [
    ...input.events ?? [],
    ...(input.closed_berths ?? []).map((berthId) => ({
      id: `close-${berthId}`,
      type: "berth_closure",
      target: berthId,
      duration_hours: 12,
      magnitude: 1
    }))
  ];
  const baseData = generatePortData();
  const baselineData = {
    berths: baseData.berths.map((b) => ({ ...b })),
    vessels: [],
    yard: baseData.yard.map((y) => ({ ...y }))
  };
  const baseline = detectCongestion(baselineData.berths, baselineData.vessels);
  const berths = baseData.berths;
  const vessels = [];
  const yard = baseData.yard;
  if (input.custom_vessels && input.custom_vessels.length > 0) {
    const customVessels = input.custom_vessels.map((cv) => {
      const unloadDuration = cv.type === "Container" ? 8 : cv.type === "Bulk" ? 15 : 11;
      const status = cv.eta_hours <= 0 ? "Docked" : "En Route";
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
        delay_reason: null
      };
    });
    vessels.push(...customVessels);
  } else {
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
      const seenIds = /* @__PURE__ */ new Set();
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
      throw new Error(`Unable to load vessels from MongoDB: ${err.message}`);
    }
  }
  const { affected } = applyScenario(berths, vessels, events);
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
  const scenario = {
    events,
    affected_vessel_ids: affected,
    baseline_score: baseline.result.port_score,
    baseline_level: baseline.result.port_level,
    scenario_score: congestion.port_score,
    scenario_level: congestion.port_level,
    added_wait_hours: Math.round((scenarioWait - baselineWait) * 10) / 10
  };
  return {
    generated_note: "Vessel data comes from user input only (CSV import, manual entry). Berth infrastructure (B1-B6) is fixed port config. No synthetic data is generated.",
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
        note: original ? originalEta === vessel.eta_hours ? "ETA unchanged since the scheduled arrival was filed." : `ETA moved ${vessel.eta_hours - originalEta > 0 ? "later" : "earlier"} by ${Math.abs(vessel.eta_hours - originalEta)} h${vessel.delay_reason ? ` \u2014 ${vessel.delay_reason}` : ""}.` : "Unscheduled arrival added by the active scenario."
      };
    }),
    yard: yardStatus,
    macro_routing: macroRouting,
    crane_rebalance: craneRebalance
  };
}

// ai/ollama.ts
var OLLAMA_URL = process.env["OLLAMA_URL"] || "http://localhost:11434";
var OLLAMA_MODEL = process.env["OLLAMA_MODEL"] || "qwen2.5:3b";
async function streamOllamaText(input, opts = {}) {
  try {
    const fullPrompt = opts.instructions ? `${opts.instructions}

User question: ${input}` : input;
    const upstream = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: 0.3,
          num_predict: 1024
        }
      })
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return new Response(
        `Ollama request failed (${upstream.status}). ${detail.slice(0, 300)}`,
        { status: upstream.status || 502 }
      );
    }
    const body = upstream.body;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          for (; ; ) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const evt = JSON.parse(line);
                if (evt.response) {
                  controller.enqueue(encoder.encode(evt.response));
                }
              } catch {
              }
            }
          }
        } catch {
          controller.enqueue(encoder.encode("\n\n[The AI response was interrupted.]"));
        } finally {
          controller.close();
        }
      }
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `Ollama connection failed: ${message}. Make sure Ollama is running (ollama serve).`,
      { status: 503 }
    );
  }
}

// ai/watsonx.ts
var WATSONX_URL = process.env["WATSONX_URL"] || "https://eu-de.ml.cloud.ibm.com";
var WATSONX_MODEL = process.env["WATSONX_MODEL_ID"] || process.env["WATSONX_MODEL"] || "ibm/granite-4-h-small";
var WATSONX_API_VERSION = process.env["WATSONX_API_VERSION"] || "2025-10-25";
var cachedToken = null;
var tokenExpiry = 0;
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const apiKey = process.env["WATSONX_APIKEY"] || process.env["WATSONX_API_KEY"];
  if (!apiKey) throw new Error("WATSONX_APIKEY or WATSONX_API_KEY is not set");
  const tokenUrl = "https://iam.cloud.ibm.com/identity/token";
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`watsonx.ai token request failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1e3;
  return cachedToken;
}
async function streamGatewayText(input, opts = {}) {
  const projectId = process.env["WATSONX_PROJECT_ID"];
  const apiKey = process.env["WATSONX_APIKEY"] || process.env["WATSONX_API_KEY"];
  if (!apiKey || !projectId) {
    return new Response(
      "AI is not configured. Set WATSONX_APIKEY and WATSONX_PROJECT_ID environment variables.",
      { status: 500 }
    );
  }
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Failed to authenticate with watsonx.ai: ${message}`, { status: 501 });
  }
  const messages = [];
  if (opts.instructions) {
    messages.push({ role: "system", content: opts.instructions });
  }
  messages.push({ role: "user", content: input });
  const upstream = await fetch(
    `${WATSONX_URL}/ml/v1/text/chat_stream?version=${WATSONX_API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        model_id: WATSONX_MODEL,
        project_id: projectId,
        messages,
        stream: true,
        max_tokens: 1024,
        temperature: 0.3
      })
    }
  );
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      `watsonx.ai request failed (${upstream.status}). ${detail.slice(0, 300)}`,
      { status: upstream.status || 502 }
    );
  }
  const body = upstream.body;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let emitted = false;
      try {
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              const delta = evt.choices?.[0]?.delta?.content;
              const text = evt.results?.[0]?.generated_text;
              if (delta) {
                emitted = true;
                controller.enqueue(encoder.encode(delta));
              } else if (text && !emitted) {
                emitted = true;
                controller.enqueue(encoder.encode(text));
              }
            } catch {
            }
          }
        }
        if (!emitted) {
          controller.enqueue(encoder.encode("The assistant returned no text. Please try again."));
        }
      } catch {
        controller.enqueue(encoder.encode("\n\n[The AI response was interrupted.]"));
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

// ai/index.ts
async function streamText(input, opts = {}) {
  try {
    const resp = await streamOllamaText(input, opts);
    if (resp.ok) return resp;
    console.warn(`Ollama returned ${resp.status}, trying WatsonX...`);
  } catch (err) {
    console.warn("Ollama unavailable, trying WatsonX...", err);
  }
  try {
    const resp = await streamGatewayText(input, opts);
    return resp;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      `No AI backend available. Ollama is not running and WatsonX failed: ${msg}`,
      { status: 503 }
    );
  }
}

// routes/plan.ts
var PLAN_SYSTEM_PROMPT = `You are a port operations assistant writing a 72-hour operational plan for a shift supervisor.

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
async function aiPlanHandler(req, res) {
  const body = req.body;
  const state = buildPortState({
    events: body.events ?? [],
    closed_berths: body.closed_berths ?? [],
    custom_vessels: body.custom_vessels ?? []
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
      waiting: point.waiting
    })),
    berths: state.berths.map((berth) => ({
      berth_id: berth.berth_id,
      status: berth.status,
      cranes: berth.crane_count,
      cranes_out: berth.cranes_out,
      handles: berth.compatible_types,
      utilization_pct: schedule.utilization.find((item) => item.berth_id === berth.berth_id)?.utilization_pct ?? 0
    })),
    scheduled_service_windows: schedule.entries.map((entry) => ({
      vessel_id: entry.vessel_id,
      berth_id: entry.berth_id,
      arrival: entry.arrival,
      service_start: entry.service_start,
      service_end: entry.service_end,
      wait_hours: entry.wait_hours,
      blocked: entry.blocked,
      block_reason: entry.block_reason
    })),
    hotspots: state.congestion.hotspots.slice(0, 12),
    recommended_moves: state.optimization.moves,
    unresolved_vessels: state.optimization.unresolved,
    hours_saved_total: state.optimization.hours_saved_total
  };
  const response = await streamText(
    `Port operations data (synthetic demo data, hours are relative to now):
${JSON.stringify(payload)}`,
    { instructions: PLAN_SYSTEM_PROMPT }
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

// routes/copilot.ts
var PORT_SYSTEM_PROMPT = `You are the AI Operations Copilot for PortPredict AI, a container port management system.

STRICT RULES:
1. Answer ONLY using the provided port state data - never invent information
2. If the data doesn't contain the answer, say "I don't have that information in the current port data"
3. Always cite specific vessel IDs, berth IDs, and numbers from the data
4. Keep responses under 150 words
5. Use plain markdown formatting
6. Never discuss topics outside port operations (weather, politics, etc.)
7. Never answer general knowledge questions - only port-specific queries

Your expertise includes:
- Vessel scheduling and berthing
- Congestion analysis and prediction
- Resource allocation optimization
- Risk assessment and mitigation
- Container yard operations

Always ground your responses in the actual data provided.`;
async function aiCopilotHandler(req, res) {
  const body = req.body;
  const question = (body.question ?? "").trim();
  if (!question) {
    res.status(400).send("Please include a question.");
    return;
  }
  const state = buildPortState({
    events: body.events ?? [],
    closed_berths: body.closed_berths ?? [],
    custom_vessels: body.custom_vessels ?? []
  });
  const schedule = buildSchedule(state.berths, state.vessels);
  const context = {
    summary: state.summary,
    metrics: state.metrics,
    congestion: {
      port_score: state.congestion.port_score,
      port_level: state.congestion.port_level,
      berths: state.congestion.berths,
      hotspots: state.congestion.hotspots.slice(0, 12)
    },
    congestion_drivers: state.drivers,
    scenario: state.scenario,
    forecast: state.prediction.map((point) => ({
      hour: point.hour,
      score: point.predicted,
      level: point.level,
      waiting: point.waiting,
      arrivals: point.arrivals
    })),
    berths: state.berths,
    vessels: state.vessels,
    service_windows: schedule.entries,
    berth_utilization: schedule.utilization,
    recommended_moves: state.optimization.moves,
    unresolved_vessels: state.optimization.unresolved
  };
  const response = await streamText(
    `Current port state (synthetic demo data, ETAs in hours from now):
${JSON.stringify(context)}

Operator question: ${question}`,
    { instructions: PORT_SYSTEM_PROMPT }
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

// routes/port-state.ts
var VALID_EVENT_TYPES = /* @__PURE__ */ new Set([
  "berth_closure",
  "berth_reopening",
  "crane_outage",
  "vessel_surge",
  "severe_weather",
  "vessel_delay"
]);
var VALID_VESSEL_TYPES = /* @__PURE__ */ new Set(["Container", "Bulk", "Tanker"]);
var VALID_PRIORITIES2 = /* @__PURE__ */ new Set(["standard", "priority"]);
function validateEvents(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => {
    if (typeof item !== "object" || item === null) return false;
    const obj = item;
    if (typeof obj.id !== "string") return false;
    if (typeof obj.type !== "string" || !VALID_EVENT_TYPES.has(obj.type)) return false;
    if (typeof obj.target !== "string") return false;
    if (typeof obj.duration_hours !== "number") return false;
    if (typeof obj.magnitude !== "number") return false;
    return true;
  });
}
function validateCustomVessels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => {
    if (typeof item !== "object" || item === null) return false;
    const obj = item;
    if (typeof obj.vessel_id !== "string") return false;
    if (typeof obj.type !== "string" || !VALID_VESSEL_TYPES.has(obj.type)) return false;
    if (typeof obj.cargo !== "string") return false;
    if (typeof obj.eta_hours !== "number") return false;
    if (typeof obj.priority !== "string" || !VALID_PRIORITIES2.has(obj.priority)) return false;
    return true;
  });
}
async function portStateHandler(req, res) {
  try {
    const body = req.body;
    const validEvents = validateEvents(body.events ?? []);
    const validCustomVessels = validateCustomVessels(body.custom_vessels ?? []);
    const state = await buildPortState({
      events: validEvents,
      closed_berths: body.closed_berths ?? [],
      custom_vessels: validCustomVessels
    });
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// routes/vessels.ts
var import_express = require("express");
var vesselsRouter = (0, import_express.Router)();
var inMemoryVessels = [];
var VALID_TYPES2 = /* @__PURE__ */ new Set(["Container", "Bulk", "Tanker"]);
var VALID_PRIORITIES3 = /* @__PURE__ */ new Set(["standard", "priority"]);
vesselsRouter.get("/", async (_req, res) => {
  try {
    if (isDBConnected()) {
      const vessels = await VesselModel.find({}).sort({ eta_hours: 1 }).lean();
      res.json({ success: true, source: "mongodb", count: vessels.length, data: vessels });
    } else {
      res.json({ success: true, source: "memory", count: inMemoryVessels.length, data: inMemoryVessels });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
vesselsRouter.post("/", async (req, res) => {
  try {
    const { vessel_id, type, cargo, eta_hours, priority } = req.body;
    if (!vessel_id || typeof vessel_id !== "string") {
      res.status(400).json({ success: false, error: "vessel_id is required" });
      return;
    }
    if (!type || !VALID_TYPES2.has(type)) {
      res.status(400).json({ success: false, error: "Invalid vessel type (Container | Bulk | Tanker)" });
      return;
    }
    if (!VALID_PRIORITIES3.has(priority)) {
      res.status(400).json({ success: false, error: "Invalid priority (standard | priority)" });
      return;
    }
    const eta = typeof eta_hours === "number" ? eta_hours : 0;
    const unloadDuration = type === "Container" ? 8 : type === "Bulk" ? 15 : 11;
    const status = eta <= 0 ? "Docked" : "En Route";
    const vesselData = {
      vessel_id,
      type,
      cargo: cargo || "General Cargo",
      eta_hours: eta,
      status,
      assigned_berth_id: null,
      unload_duration_hours: unloadDuration,
      wait_time_hours: 0,
      priority,
      delay_reason: null
    };
    if (isDBConnected()) {
      const updated = await VesselModel.findOneAndUpdate(
        { vessel_id },
        vesselData,
        { upsert: true, new: true, runValidators: true }
      ).lean();
      res.status(201).json({ success: true, source: "mongodb", data: updated });
    } else {
      const idx = inMemoryVessels.findIndex((v) => v.vessel_id === vessel_id);
      if (idx >= 0) {
        inMemoryVessels[idx] = vesselData;
      } else {
        inMemoryVessels.push(vesselData);
      }
      res.status(201).json({ success: true, source: "memory", data: vesselData });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
vesselsRouter.post("/import", async (req, res) => {
  try {
    const { vessels } = req.body;
    if (!Array.isArray(vessels)) {
      res.status(400).json({ success: false, error: "vessels array is required" });
      return;
    }
    const formatted = vessels.filter((v) => v && typeof v.vessel_id === "string" && VALID_TYPES2.has(v.type)).map((v) => {
      const eta = typeof v.eta_hours === "number" ? v.eta_hours : 0;
      const type = v.type;
      const unloadDuration = type === "Container" ? 8 : type === "Bulk" ? 15 : 11;
      return {
        vessel_id: v.vessel_id,
        type,
        cargo: v.cargo || "General Cargo",
        eta_hours: eta,
        status: eta <= 0 ? "Docked" : "En Route",
        assigned_berth_id: null,
        unload_duration_hours: unloadDuration,
        wait_time_hours: 0,
        priority: VALID_PRIORITIES3.has(v.priority) ? v.priority : "standard",
        delay_reason: null
      };
    });
    if (isDBConnected()) {
      const bulkOps = formatted.map((vessel) => ({
        updateOne: {
          filter: { vessel_id: vessel.vessel_id },
          update: { $set: vessel },
          upsert: true
        }
      }));
      await VesselModel.bulkWrite(bulkOps);
      const allVessels = await VesselModel.find({}).sort({ eta_hours: 1 }).lean();
      res.json({ success: true, source: "mongodb", added: formatted.length, data: allVessels });
    } else {
      formatted.forEach((vessel) => {
        const idx = inMemoryVessels.findIndex((v) => v.vessel_id === vessel.vessel_id);
        if (idx >= 0) {
          inMemoryVessels[idx] = vessel;
        } else {
          inMemoryVessels.push(vessel);
        }
      });
      res.json({ success: true, source: "memory", added: formatted.length, data: inMemoryVessels });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
vesselsRouter.put("/:id", async (req, res) => {
  try {
    const vessel_id = req.params["id"];
    if (isDBConnected()) {
      const updated = await VesselModel.findOneAndUpdate(
        { vessel_id },
        { $set: req.body },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) {
        res.status(404).json({ success: false, error: "Vessel not found" });
        return;
      }
      res.json({ success: true, source: "mongodb", data: updated });
    } else {
      const idx = inMemoryVessels.findIndex((v) => v.vessel_id === vessel_id);
      if (idx === -1) {
        res.status(404).json({ success: false, error: "Vessel not found" });
        return;
      }
      inMemoryVessels[idx] = { ...inMemoryVessels[idx], ...req.body };
      res.json({ success: true, source: "memory", data: inMemoryVessels[idx] });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
vesselsRouter.delete("/:id", async (req, res) => {
  try {
    const vessel_id = req.params["id"];
    if (isDBConnected()) {
      await VesselModel.deleteOne({ vessel_id });
      res.json({ success: true, source: "mongodb", message: `Vessel ${vessel_id} deleted` });
    } else {
      inMemoryVessels = inMemoryVessels.filter((v) => v.vessel_id !== vessel_id);
      res.json({ success: true, source: "memory", message: `Vessel ${vessel_id} deleted` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
vesselsRouter.post("/apply-optimization", async (req, res) => {
  try {
    const currentState = await buildPortState({
      events: req.body.events ?? [],
      closed_berths: req.body.closed_berths ?? [],
      custom_vessels: req.body.custom_vessels ?? []
    });
    const moves = currentState.optimization?.moves ?? [];
    if (moves.length === 0) {
      res.json({
        success: true,
        applied_count: 0,
        skipped_count: 0,
        message: "No optimization changes to apply",
        data: currentState
      });
      return;
    }
    let appliedCount = 0;
    let skippedCount = 0;
    for (const move of moves) {
      const vessel = currentState.vessels.find((v) => v.vessel_id === move.vessel_id);
      const targetBerth = currentState.berths.find((b) => b.berth_id === move.to_berth_id);
      if (!vessel || !targetBerth || targetBerth.status === "closed") {
        console.warn(`[Apply Optimization] Invalid move skipped: ${move.vessel_id} -> ${move.to_berth_id}`);
        skippedCount++;
        continue;
      }
      if (isDBConnected()) {
        await VesselModel.updateOne(
          { vessel_id: move.vessel_id },
          {
            $set: {
              assigned_berth_id: move.to_berth_id,
              wait_time_hours: move.wait_after_hours
            }
          }
        );
      } else {
        const memIdx = inMemoryVessels.findIndex((v) => v.vessel_id === move.vessel_id);
        if (memIdx >= 0) {
          inMemoryVessels[memIdx].assigned_berth_id = move.to_berth_id;
          inMemoryVessels[memIdx].wait_time_hours = move.wait_after_hours;
        }
      }
      appliedCount++;
    }
    const updatedState = await buildPortState({
      events: req.body.events ?? [],
      closed_berths: req.body.closed_berths ?? []
    });
    console.log(`[Apply Optimization] Successfully committed ${appliedCount} move(s) to port state.`);
    res.json({
      success: true,
      applied_count: appliedCount,
      skipped_count: skippedCount,
      message: `Successfully applied ${appliedCount} optimization move(s)`,
      data: updatedState
    });
  } catch (error) {
    console.error("[Apply Optimization] Error applying moves:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
vesselsRouter.delete("/", async (_req, res) => {
  try {
    inMemoryVessels = [];
    res.json({ success: true, message: "In-memory state reset (MongoDB records preserved)" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// index.ts
var app = (0, import_express2.default)();
var PORT = process.env["PORT"] || 3001;
app.use((0, import_cors.default)({ origin: true }));
app.use(import_express2.default.json({ limit: "512kb" }));
app.post("/api/ai/plan", aiPlanHandler);
app.post("/api/ai/copilot", aiCopilotHandler);
app.post("/api/port-state", portStateHandler);
app.use("/api/vessels", vesselsRouter);
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mongodb: isDBConnected() ? "connected" : "fallback/disconnected",
    timestamp: Date.now()
  });
});
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
