// Deterministic berth service schedule — the single source of truth.
// The simulation, the Gantt plan, congestion detection, the metrics and the
// tables all read this same function, so nothing can drift out of sync.
// Pure and client-safe: no randomness, no clock, no I/O.

import type {
  Berth,
  ScheduleResult,
  ServiceEntry,
  Vessel,
  BerthUtilization,
} from "./types";

export const HORIZON = 72;

export function effectiveCranes(berth: Berth): number {
  return Math.max(0, berth.crane_count - (berth.cranes_out ?? 0));
}

/**
 * The hour at which a berth can first take a vessel. A closure with a stated
 * end hour only removes capacity until that hour; an open berth returns 0.
 */
export function reopenHour(berth: Berth): number {
  if (effectiveCranes(berth) <= 0) return HORIZON;
  if (berth.status !== "closed") return 0;
  const end = berth.closure_end_hour;
  return end === null || end >= HORIZON ? HORIZON : Math.max(0, end);
}

/** Usable at some point inside the 72-hour window. */
export function berthUsable(berth: Berth): boolean {
  return reopenHour(berth) < HORIZON;
}

/** Usable right now (hour 0) — used for "berths available" style counts. */
export function berthUsableNow(berth: Berth): boolean {
  return reopenHour(berth) <= 0;
}


export function compatible(berth: Berth, vessel: Vessel): boolean {
  return berth.compatible_types.includes(vessel.type);
}

/** More cranes = faster handling; yard congestion slows discharge when yard blocks are saturated (>75% / >85%). */
export function serviceHours(vessel: Vessel, berth: Berth): number {
<<<<<<< HEAD
  let hours = vessel.unload_duration_hours;
=======
  const cranes = Math.max(1, effectiveCranes(berth));
  let hours = Math.round(vessel.unload_duration_hours * (3 / cranes));
>>>>>>> 6e35b3b1bbe3441fb746ac6adec222711d593e38

  // Yard space congestion constraint: saturated yard blocks slow down RTG shuttles and container stacking
  if (vessel.type === "Container" && berth.yard_saturation_pct) {
    if (berth.yard_saturation_pct >= 85) {
      hours = Math.round(hours * 1.25);
    } else if (berth.yard_saturation_pct >= 75) {
      hours = Math.round(hours * 1.1);
    }
  }
  return Math.max(2, hours);
}

/** Priority vessels get a 3-hour head start in the queue order. */
function queueKey(vessel: Vessel): number {
  return vessel.eta_hours - (vessel.priority === "priority" ? 3 : 0);
}

export function buildSchedule(berths: Berth[], vessels: Vessel[]): ScheduleResult {
  const entries: ServiceEntry[] = [];
  const utilization: BerthUtilization[] = [];

  for (const berth of berths) {
    const reopen = reopenHour(berth);
    const usable = reopen < HORIZON;
    const cranes = effectiveCranes(berth);
    const queue = vessels
      .filter((vessel) => vessel.assigned_berth_id === berth.berth_id)
      .sort((a, b) => queueKey(a) - queueKey(b) || a.vessel_id.localeCompare(b.vessel_id));

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
          block_reason:
            berth.status === "closed"
              ? `${berth.berth_id} is closed for the whole 72 h window${berth.closure_reason ? ` — ${berth.closure_reason}` : ""}`
              : `${berth.berth_id} has no working cranes`,
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
          block_reason: `${berth.berth_id} cannot handle ${vessel.type} vessels`,
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
        block_reason: null,
      });

      busy += Math.max(0, Math.min(end, HORIZON) - Math.max(start, 0));
      freeAt = end;
    }

    // A timed closure only removes the hours it actually covers.
    const available = usable ? HORIZON - reopen : 0;

    utilization.push({
      berth_id: berth.berth_id,
      busy_hours: Math.round(busy * 10) / 10,
      available_hours: available,
      utilization_pct: available ? Math.min(100, Math.round((busy / available) * 100)) : 0,
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
      block_reason: "No compatible berth assigned",
    });
  }

  const totalBusy = utilization.reduce((sum, item) => sum + item.busy_hours, 0);
  const totalAvailable = utilization.reduce((sum, item) => sum + item.available_hours, 0);

  return {
    entries,
    utilization,
    port_utilization_pct: totalAvailable
      ? Math.min(100, Math.round((totalBusy / totalAvailable) * 100))
      : 0,
  };
}

export function entryFor(schedule: ScheduleResult, vesselId: string): ServiceEntry | undefined {
  return schedule.entries.find((entry) => entry.vessel_id === vesselId);
}

/** How many vessels are waiting (arrived, not yet in service) at a given hour. */
export function waitingAt(schedule: ScheduleResult, hour: number): ServiceEntry[] {
  return schedule.entries.filter(
    (entry) =>
      entry.arrival <= hour &&
      (entry.service_start === null || entry.service_start > hour) &&
      (entry.service_end === null || entry.service_end > hour),
  );
}

export function berthedAt(schedule: ScheduleResult, hour: number): ServiceEntry[] {
  return schedule.entries.filter(
    (entry) =>
      entry.service_start !== null &&
      entry.service_end !== null &&
      entry.service_start <= hour &&
      entry.service_end > hour,
  );
}
