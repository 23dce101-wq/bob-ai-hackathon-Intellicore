import mongoose from "mongoose";

const V201_V220 = [
  { vessel_id: "V201", type: "Container", cargo: "Electronics Batch", eta_hours: 0, status: "Docked", assigned_berth_id: "B1", unload_duration_hours: 8, wait_time_hours: 0, priority: "priority", delay_reason: null },
  { vessel_id: "V202", type: "Container", cargo: "Auto Parts & Engines", eta_hours: 2, status: "En Route", assigned_berth_id: "B2", unload_duration_hours: 8, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V203", type: "Bulk", cargo: "Iron Ore & Grain", eta_hours: 4, status: "En Route", assigned_berth_id: null, unload_duration_hours: 15, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V204", type: "Tanker", cargo: "Crude Oil", eta_hours: 6, status: "En Route", assigned_berth_id: "B4", unload_duration_hours: 11, wait_time_hours: 0, priority: "priority", delay_reason: null },
  { vessel_id: "V205", type: "Container", cargo: "Consumer Electronics", eta_hours: 8, status: "En Route", assigned_berth_id: null, unload_duration_hours: 8, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V206", type: "Bulk", cargo: "Coal & Minerals", eta_hours: 10, status: "En Route", assigned_berth_id: null, unload_duration_hours: 15, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V207", type: "Tanker", cargo: "Refined Fuel", eta_hours: 12, status: "En Route", assigned_berth_id: null, unload_duration_hours: 11, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V208", type: "Container", cargo: "Textiles & Garments", eta_hours: 15, status: "En Route", assigned_berth_id: null, unload_duration_hours: 8, wait_time_hours: 0, priority: "priority", delay_reason: null },
  { vessel_id: "V209", type: "Bulk", cargo: "Grain Shipment", eta_hours: 18, status: "En Route", assigned_berth_id: null, unload_duration_hours: 14, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V210", type: "Tanker", cargo: "Liquefied Gas", eta_hours: 21, status: "En Route", assigned_berth_id: null, unload_duration_hours: 12, wait_time_hours: 0, priority: "priority", delay_reason: null },
  { vessel_id: "V211", type: "Container", cargo: "Heavy Industrial Tools", eta_hours: 24, status: "En Route", assigned_berth_id: null, unload_duration_hours: 9, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V212", type: "Bulk", cargo: "Bauxite Ore", eta_hours: 28, status: "En Route", assigned_berth_id: null, unload_duration_hours: 16, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V213", type: "Container", cargo: "Medical Equipment", eta_hours: 32, status: "En Route", assigned_berth_id: null, unload_duration_hours: 8, wait_time_hours: 0, priority: "priority", delay_reason: null },
  { vessel_id: "V214", type: "Tanker", cargo: "Chemical Freight", eta_hours: 36, status: "En Route", assigned_berth_id: null, unload_duration_hours: 10, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V215", type: "Container", cargo: "Frozen Cargo & Foods", eta_hours: 40, status: "En Route", assigned_berth_id: null, unload_duration_hours: 8, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V216", type: "Bulk", cargo: "Raw Timber & Wood", eta_hours: 44, status: "En Route", assigned_berth_id: null, unload_duration_hours: 15, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V217", type: "Tanker", cargo: "Petroleum Distillates", eta_hours: 48, status: "En Route", assigned_berth_id: null, unload_duration_hours: 11, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V218", type: "Container", cargo: "Solar Panels & Batteries", eta_hours: 51, status: "En Route", assigned_berth_id: null, unload_duration_hours: 8, wait_time_hours: 0, priority: "priority", delay_reason: null },
  { vessel_id: "V219", type: "Tanker", cargo: "Jet Fuel", eta_hours: 54, status: "En Route", assigned_berth_id: null, unload_duration_hours: 12, wait_time_hours: 0, priority: "standard", delay_reason: null },
  { vessel_id: "V220", type: "Bulk", cargo: "Copper Concentrate", eta_hours: 60, status: "En Route", assigned_berth_id: null, unload_duration_hours: 15, wait_time_hours: 0, priority: "standard", delay_reason: null }
];

async function ensureVessels() {
  const uri = "mongodb://127.0.0.1:27017/portpredict";
  const conn = await mongoose.createConnection(uri).asPromise();
  const col = conn.db.collection("vessels");
  const count = await col.countDocuments();
  console.log(`Current vessels count in portpredict.vessels: ${count}`);

  if (count === 0) {
    console.log("Populating V201-V220 vessels into portpredict.vessels...");
    await col.insertMany(V201_V220);
    const newCount = await col.countDocuments();
    console.log(`New vessels count in portpredict.vessels: ${newCount}`);
  }

  const sample = await col.find({}).limit(3).toArray();
  console.log("Sample vessel_ids:", sample.map(s => s.vessel_id));

  await conn.close();
  process.exit(0);
}

ensureVessels();
