import mongoose, { Schema, Document } from "mongoose";
import type { VesselType, VesselStatus, VesselPriority } from "../lib/port/types.js";

export interface IVesselDocument extends Document {
  vessel_id: string;
  type: VesselType;
  cargo: string;
  eta_hours: number;
  status: VesselStatus;
  assigned_berth_id: string | null;
  unload_duration_hours: number;
  wait_time_hours: number;
  priority: VesselPriority;
  delay_reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const VesselSchema = new Schema<IVesselDocument>(
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
    delay_reason: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const VesselModel =
  mongoose.models["Vessel"] || mongoose.model<IVesselDocument>("Vessel", VesselSchema, "vessels");
