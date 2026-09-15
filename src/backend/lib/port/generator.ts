// Synthetic dataset generator for PortOptiAI.
// Generates berth infrastructure only — vessels come from user input (CSV / manual).
// Yard blocks start empty and fill based on actual vessel assignments.

import type { Berth, PortDataset, Vessel, VesselType, YardBlock } from "./types";

// Small deterministic PRNG (mulberry32) so every run/reset is reproducible.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BerthSpec {
  cranes: number;
  length_m: number;
  types: VesselType[];
}

const BERTH_SPEC: Record<string, BerthSpec> = {
  B1: { cranes: 4, length_m: 350, types: ["Container", "Bulk"] },
  B2: { cranes: 3, length_m: 300, types: ["Container"] },
  B3: { cranes: 5, length_m: 400, types: ["Container", "Bulk", "Tanker"] },
  B4: { cranes: 2, length_m: 240, types: ["Bulk", "Tanker"] },
  B5: { cranes: 3, length_m: 280, types: ["Container", "Tanker"] },
  B6: { cranes: 4, length_m: 330, types: ["Container", "Bulk"] },
};

const YARD_BLOCK_SPEC: Array<{
  block_id: string;
  total_teu: number;
  serving_berths: string[];
}> = [
  { block_id: "Y1", total_teu: 4200, serving_berths: ["B1", "B2"] },
  { block_id: "Y2", total_teu: 3800, serving_berths: ["B3", "B4"] },
  { block_id: "Y3", total_teu: 4500, serving_berths: ["B5", "B6"] },
  { block_id: "Y4", total_teu: 3200, serving_berths: ["B1", "B6"] },
];

export function makeYardBlocks(rand: () => number, vesselCount: number): YardBlock[] {
  // Each block starts with a varied realistic utilization based on its role
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
      serving_berths: spec.serving_berths,
    };
  });
}

export function makeBerths(): Berth[] {
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
      yard_saturation_pct: 0,
    };
  });
}

/** Recomputes each berth's currently docked vessel + next ETA. */
export function refreshBerthPointers(berths: Berth[], vessels: Vessel[]): void {
  for (const berth of berths) {
    const queue = vessels
      .filter((vessel) => vessel.assigned_berth_id === berth.berth_id)
      .sort((a, b) => a.eta_hours - b.eta_hours);
    const docked = queue.find((vessel) => vessel.eta_hours <= 0);
    berth.current_vessel_id = berth.status === "closed" ? null : (docked?.vessel_id ?? null);
    const next = queue.find((vessel) => vessel.eta_hours > 0);
    berth.next_vessel_eta = next ? next.eta_hours : null;
  }
}

export function generatePortData(): PortDataset {
  const berths = makeBerths();
  const vessels: Vessel[] = [];
  const rand = rng(Date.now());
  const yard = makeYardBlocks(rand, 0);

  for (const berth of berths) {
    const block = yard.find((b) => b.block_id === berth.yard_block_id);
    berth.yard_saturation_pct = block ? Math.round((block.used_teu / block.total_teu) * 100) : 0;
  }

  return { berths, vessels, yard };
}
