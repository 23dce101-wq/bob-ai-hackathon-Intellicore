import { Request, Response } from "express";
import { buildPortState } from "../lib/state.js";
import type { ScenarioEvent } from "../lib/port/types.js";

const VALID_EVENT_TYPES = new Set([
  "berth_closure",
  "berth_reopening",
  "crane_outage",
  "vessel_surge",
  "severe_weather",
  "vessel_delay",
]);

const VALID_VESSEL_TYPES = new Set(["Container", "Bulk", "Tanker"]);
const VALID_PRIORITIES = new Set(["standard", "priority"]);

function validateEvents(raw: unknown[]): ScenarioEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ScenarioEvent => {
    if (typeof item !== "object" || item === null) return false;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== "string") return false;
    if (typeof obj.type !== "string" || !VALID_EVENT_TYPES.has(obj.type)) return false;
    if (typeof obj.target !== "string") return false;
    if (typeof obj.duration_hours !== "number") return false;
    if (typeof obj.magnitude !== "number") return false;
    return true;
  });
}

function validateCustomVessels(raw: unknown[]): Array<{
  vessel_id: string;
  type: "Container" | "Bulk" | "Tanker";
  cargo: string;
  eta_hours: number;
  priority: "standard" | "priority";
}> {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => {
    if (typeof item !== "object" || item === null) return false;
    const obj = item as Record<string, unknown>;
    if (typeof obj.vessel_id !== "string") return false;
    if (typeof obj.type !== "string" || !VALID_VESSEL_TYPES.has(obj.type)) return false;
    if (typeof obj.cargo !== "string") return false;
    if (typeof obj.eta_hours !== "number") return false;
    if (typeof obj.priority !== "string" || !VALID_PRIORITIES.has(obj.priority)) return false;
    return true;
  }) as Array<{
    vessel_id: string;
    type: "Container" | "Bulk" | "Tanker";
    cargo: string;
    eta_hours: number;
    priority: "standard" | "priority";
  }>;
}

export async function portStateHandler(req: Request, res: Response) {
  try {
    const body = req.body as {
      events?: unknown[];
      closed_berths?: string[];
      custom_vessels?: unknown[];
    };

    const validEvents = validateEvents(body.events ?? []);
    const validCustomVessels = validateCustomVessels(body.custom_vessels ?? []);

    const state = await buildPortState({
      events: validEvents,
      closed_berths: body.closed_berths ?? [],
      custom_vessels: validCustomVessels,
    });

    res.json(state);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
