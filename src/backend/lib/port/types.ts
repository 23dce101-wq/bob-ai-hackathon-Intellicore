// PortOptiAI shared data model.
// NOTE: All data in this project is SYNTHETIC. There is no real port feed,
// AIS connection, SCADA link or IoT hardware involved anywhere in this codebase.
// Every number shown in the UI is derived deterministically from this model.

export type BerthStatus = "operational" | "closed";
export type VesselType = "Container" | "Bulk" | "Tanker";
export type VesselStatus = "En Route" | "Waiting" | "Docked";
export type CongestionLevel = "low" | "medium" | "high" | "critical";
export type VesselPriority = "standard" | "priority";

export interface Berth {
  berth_id: string;
  status: BerthStatus;
  crane_count: number;
  /** Cranes out of service (crane-outage scenario). Effective cranes = count - out. */
  cranes_out: number;
  current_vessel_id: string | null;
  next_vessel_eta: number | null; // hours from "now"
  closure_reason: string | null;
  closure_end_hour: number | null; // hours from "now"
  length_m: number;
  compatible_types: VesselType[];
  yard_block_id: string | null;
  yard_saturation_pct: number;
}

export interface Vessel {
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
  routing_strategy?: RoutingStrategy;
}

/** One vessel's service window at a berth — the schedule everything else reads. */
export interface ServiceEntry {
  vessel_id: string;
  berth_id: string | null;
  type: VesselType;
  priority: VesselPriority;
  arrival: number;
  service_start: number | null;
  service_end: number | null;
  service_hours: number;
  wait_hours: number;
  cranes_assigned: number;
  blocked: boolean;
  block_reason: string | null;
}

export interface BerthUtilization {
  berth_id: string;
  busy_hours: number;
  available_hours: number;
  utilization_pct: number;
}

export interface ScheduleResult {
  entries: ServiceEntry[];
  utilization: BerthUtilization[];
  port_utilization_pct: number;
}

export interface YardBlock {
  block_id: string;
  total_teu: number;
  used_teu: number;
  reserved_teu: number;
  /** Yard trucks (RTGs) assigned to this block */
  rtg_count: number;
  /** Whether RTG is operational */
  rtg_operational: boolean;
  /** Berth this yard block primarily serves */
  serving_berths: string[];
}

export interface YardStatus {
  blocks: YardBlock[];
  total_teu: number;
  used_teu: number;
  utilization_pct: number;
  /** Number of blocks at or above 90% saturation */
  saturated_blocks: number;
  /** Estimated yard truck availability ratio */
  rtg_availability_pct: number;
  level: CongestionLevel;
}

export interface PortSummary {
  total_berths: number;
  operational_berths: number;
  total_cranes: number;
  available_cranes: number;
  vessels_in_port: number;
  vessels_waiting: number;
  yard_utilization_pct: number;
  yard_saturation_blocks: number;
}

export interface PortDataset {
  berths: Berth[];
  vessels: Vessel[];
  yard: YardBlock[];
}

export interface Hotspot {
  berth_id: string;
  vessel_id: string;
  eta_hours: number;
  berth_free_at: number;
  overlap_hours: number;
  severity: CongestionLevel;
  reason: string;
}

export interface BerthCongestion {
  berth_id: string;
  overlap_count: number;
  avg_wait_hours: number;
  utilization_pct: number;
  score: number; // 0-100
  level: CongestionLevel;
}

export interface CongestionResult {
  hotspots: Hotspot[];
  berths: BerthCongestion[];
  port_score: number;
  port_level: CongestionLevel;
}

export interface PredictionPoint {
  hour: number;
  label: string;
  current: number | null; // observed-so-far part of the series
  predicted: number;
  level: CongestionLevel;
  arrivals: number;
  waiting: number;
  berthed: number;
  usable_berths: number;
  drivers: string[];
}

export interface CongestionDriver {
  title: string;
  detail: string;
  weight: number; // 0-100 relative contribution, derived from state
}

export interface KeyMetrics {
  avg_wait_hours: number;
  avg_turnaround_hours: number;
  berth_utilization_pct: number;
  delayed_vessel_count: number;
  /** Honest definition of the synthetic metrics shown in the UI. */
  metric_note: string;
}

export interface ReassignmentMove {
  vessel_id: string;
  from_berth_id: string | null;
  to_berth_id: string;
  wait_before_hours: number;
  wait_after_hours: number;
  hours_saved: number;
  cranes_assigned: number;
  reason_lines: string[];
}

export interface OptimizationResult {
  moves: ReassignmentMove[];
  unresolved: string[];
  before: CongestionResult;
  after: CongestionResult;
  metrics_before: KeyMetrics;
  metrics_after: KeyMetrics;
  hours_saved_total: number;
  vessels_after: Vessel[];
  routing_strategies: RoutingStrategy[];
  crane_transfers: CraneTransfer[];
  fuel_saved_total_tons: number;
  co2_saved_total_tons: number;
}

export interface MacroRoutingAdvice {
  vessel_id: string;
  strategy: "slow_steaming" | "offshore_holding" | "divert_secondary_port" | "advance_booking";
  detail: string;
  fuel_savings_kg: number | null;
  time_impact_hours: number;
  target_port: string | null;
}

export interface RoutingStrategy {
  vessel_id: string;
  action: "direct_berth" | "slow_steaming" | "anchorage_holding" | "inter_terminal_divert";
  original_speed_knots: number;
  advisory_speed_knots: number;
  speed_reduction_pct: number;
  fuel_saved_tons: number;
  co2_saved_tons: number;
  anchorage_zone: string | null;
  diversion_terminal: string | null;
  holding_hours: number;
  rationale: string;
}

export interface CraneRebalanceMove {
  from_berth_id: string;
  to_berth_id: string;
  cranes_moved: number;
  reason: string;
  congestion_reduction_estimate: number;
}

export interface CraneTransfer {
  transfer_id: string;
  from_berth_id: string;
  to_berth_id: string;
  cranes_moved: number;
  hours_duration: number;
  rationale: string;
}

export type ScenarioEventType =
  | "berth_closure"
  | "berth_reopening"
  | "crane_outage"
  | "vessel_surge"
  | "severe_weather"
  | "vessel_delay";

export interface ScenarioEvent {
  id: string;
  type: ScenarioEventType;
  /** Berth id, vessel id, or "PORT" for port-wide events. */
  target: string;
  duration_hours: number;
  /** Cranes lost, extra vessels, or delay hours depending on type. */
  magnitude: number;
}

/** How a vessel's ETA moved from the baseline schedule to the current one. */
export interface EtaHistoryEntry {
  vessel_id: string;
  original_eta: number;
  current_eta: number;
  note: string;
}

export interface ScenarioImpact {

  events: ScenarioEvent[];
  affected_vessel_ids: string[];
  baseline_score: number;
  baseline_level: CongestionLevel;
  scenario_score: number;
  scenario_level: CongestionLevel;
  added_wait_hours: number;
}

export interface PortStatePayload {
  generated_note: string;
  berths: Berth[];
  vessels: Vessel[];
  summary: PortSummary;
  metrics: KeyMetrics;
  congestion: CongestionResult;
  prediction: PredictionPoint[];
  drivers: CongestionDriver[];
  optimization: OptimizationResult;
  scenario: ScenarioImpact;
  closed_berths: string[];
  eta_history: EtaHistoryEntry[];
  yard: YardStatus;
  macro_routing: MacroRoutingAdvice[];
  crane_rebalance: CraneRebalanceMove[];
}
