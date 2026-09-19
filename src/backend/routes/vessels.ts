import { Router, Request, Response } from "express";
import { VesselModel } from "../models/vessel.model.js";
import { isDBConnected } from "../lib/db.js";
import { buildPortState } from "../lib/state.js";
import type { VesselType, VesselPriority } from "../lib/port/types.js";

export const vesselsRouter = Router();

// In-memory fallback array if DB is not connected
let inMemoryVessels: Array<{
  vessel_id: string;
  type: VesselType;
  cargo: string;
  eta_hours: number;
  priority: VesselPriority;
  status: "En Route" | "Waiting" | "Docked";
  assigned_berth_id: string | null;
  unload_duration_hours: number;
  wait_time_hours: number;
  delay_reason: string | null;
}> = [];

const VALID_TYPES = new Set(["Container", "Bulk", "Tanker"]);
const VALID_PRIORITIES = new Set(["standard", "priority"]);

/**
 * GET /api/vessels
 * Get all vessels stored in MongoDB database (or fallback in-memory list)
 */
vesselsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    if (isDBConnected()) {
      const vessels = await VesselModel.find({}).sort({ eta_hours: 1 }).lean();
      res.json({ success: true, source: "mongodb", count: vessels.length, data: vessels });
    } else {
      res.json({ success: true, source: "memory", count: inMemoryVessels.length, data: inMemoryVessels });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/vessels
 * Create or save a new vessel into MongoDB
 */
vesselsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { vessel_id, type, cargo, eta_hours, priority } = req.body;

    if (!vessel_id || typeof vessel_id !== "string") {
      res.status(400).json({ success: false, error: "vessel_id is required" });
      return;
    }
    if (!type || !VALID_TYPES.has(type)) {
      res.status(400).json({ success: false, error: "Invalid vessel type (Container | Bulk | Tanker)" });
      return;
    }
    if (!VALID_PRIORITIES.has(priority)) {
      res.status(400).json({ success: false, error: "Invalid priority (standard | priority)" });
      return;
    }

    const eta = typeof eta_hours === "number" ? eta_hours : 0;
    const unloadDuration = type === "Container" ? 8 : type === "Bulk" ? 15 : 11;
    const status = eta <= 0 ? "Docked" : "En Route";

    const vesselData = {
      vessel_id,
      type: type as VesselType,
      cargo: cargo || "General Cargo",
      eta_hours: eta,
      status,
      assigned_berth_id: null,
      unload_duration_hours: unloadDuration,
      wait_time_hours: 0,
      priority: priority as VesselPriority,
      delay_reason: null,
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
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/vessels/import
 * Bulk import vessels into MongoDB database
 */
vesselsRouter.post("/import", async (req: Request, res: Response) => {
  try {
    const { vessels } = req.body;
    if (!Array.isArray(vessels)) {
      res.status(400).json({ success: false, error: "vessels array is required" });
      return;
    }

    const formatted = vessels
      .filter((v) => v && typeof v.vessel_id === "string" && VALID_TYPES.has(v.type))
      .map((v) => {
        const eta = typeof v.eta_hours === "number" ? v.eta_hours : 0;
        const type = v.type as VesselType;
        const unloadDuration = type === "Container" ? 8 : type === "Bulk" ? 15 : 11;
        return {
          vessel_id: v.vessel_id,
          type,
          cargo: v.cargo || "General Cargo",
          eta_hours: eta,
          status: (eta <= 0 ? "Docked" : "En Route") as "Docked" | "En Route",
          assigned_berth_id: null,
          unload_duration_hours: unloadDuration,
          wait_time_hours: 0,
          priority: (VALID_PRIORITIES.has(v.priority) ? v.priority : "standard") as VesselPriority,
          delay_reason: null,
        };
      });

    if (isDBConnected()) {
      const bulkOps = formatted.map((vessel) => ({
        updateOne: {
          filter: { vessel_id: vessel.vessel_id },
          update: { $set: vessel },
          upsert: true,
        },
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
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /api/vessels/:id
 * Update vessel in MongoDB
 */
vesselsRouter.put("/:id", async (req: Request, res: Response) => {
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
      inMemoryVessels[idx] = { ...inMemoryVessels[idx]!, ...req.body };
      res.json({ success: true, source: "memory", data: inMemoryVessels[idx] });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/vessels/:id
 * Delete vessel from MongoDB
 */
vesselsRouter.delete("/:id", async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/vessels/apply-optimization
 * Validates and commits optimization moves to the operational port state and MongoDB database.
 */
vesselsRouter.post("/apply-optimization", async (req: Request, res: Response) => {
  try {
    const currentState = await buildPortState({
      events: req.body.events ?? [],
      closed_berths: req.body.closed_berths ?? [],
      custom_vessels: req.body.custom_vessels ?? [],
    });

    const moves = currentState.optimization?.moves ?? [];
    if (moves.length === 0) {
      res.json({
        success: true,
        applied_count: 0,
        skipped_count: 0,
        message: "No optimization changes to apply",
        data: currentState,
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
              wait_time_hours: move.wait_after_hours,
            },
          }
        );
      } else {
        const memIdx = inMemoryVessels.findIndex((v) => v.vessel_id === move.vessel_id);
        if (memIdx >= 0) {
          inMemoryVessels[memIdx]!.assigned_berth_id = move.to_berth_id;
          inMemoryVessels[memIdx]!.wait_time_hours = move.wait_after_hours;
        }
      }
      appliedCount++;
    }

    const updatedState = await buildPortState({
      events: req.body.events ?? [],
      closed_berths: req.body.closed_berths ?? [],
    });

    console.log(`[Apply Optimization] Successfully committed ${appliedCount} move(s) to port state.`);

    res.json({
      success: true,
      applied_count: appliedCount,
      skipped_count: skippedCount,
      message: `Successfully applied ${appliedCount} optimization move(s)`,
      data: updatedState,
    });
  } catch (error) {
    console.error("[Apply Optimization] Error applying moves:", error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/vessels
 * Reset in-memory custom vessels without deleting database records
 */
vesselsRouter.delete("/", async (_req: Request, res: Response) => {
  try {
    inMemoryVessels = [];
    res.json({ success: true, message: "In-memory state reset (MongoDB records preserved)" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
