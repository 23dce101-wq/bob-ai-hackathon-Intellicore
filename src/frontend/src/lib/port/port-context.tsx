import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import type { CongestionResult, KeyMetrics, PortStatePayload, ScenarioEvent, Vessel, VesselType, VesselPriority } from "./types";

interface PortState {
  events: ScenarioEvent[];
  customVessels: Vessel[];
  applied: boolean;
  selectedVessel: string | null;
  addEvent: (event: ScenarioEvent) => void;
  removeEvent: (id: string) => void;
  setEvents: (events: ScenarioEvent[]) => void;
  setApplied: (v: boolean) => void;
  setSelectedVessel: (id: string | null) => void;
  addCustomVessel: (vessel: {
    vessel_id: string;
    type: VesselType;
    cargo: string;
    eta_hours: number;
    priority: VesselPriority;
  }) => Vessel;
  importVessels: (vessels: {
    vessel_id: string;
    type: VesselType;
    cargo: string;
    eta_hours: number;
    priority: VesselPriority;
  }[]) => { success: boolean; added: number; errors: string[] };
  resetEvents: () => void;
  resetAll: () => void;
  portData: PortStatePayload | null;
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
  setPortData: (data: PortStatePayload | null) => void;
  setQueryState: (state: { isPending: boolean; isFetching: boolean; error: Error | null }) => void;
  vessels: Vessel[];
  congestion: CongestionResult | undefined;
  metrics: KeyMetrics | undefined;
  addToast: (message: string, type?: "success" | "info" | "warning") => void;
}

const PortContext = createContext<PortState | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function PortProvider({ children }: { children: ReactNode }) {
  const [events, setEventsState] = useState<ScenarioEvent[]>(() => loadJson("port-events", []));
  const [applied, setApplied] = useState(() => {
    return sessionStorage.getItem("port-applied") === "true";
  });
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);
  const [customVessels, setCustomVessels] = useState<Vessel[]>(() => loadJson("port-custom-vessels", []));
  const [portData, setPortData] = useState<PortStatePayload | null>(null);
  const [queryState, setQueryState] = useState<{ isPending: boolean; isFetching: boolean; error: Error | null }>({
    isPending: true,
    isFetching: true,
    error: null,
  });

  useEffect(() => {
    sessionStorage.setItem("port-applied", String(applied));
  }, [applied]);

  useEffect(() => {
    localStorage.setItem("port-events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem("port-custom-vessels", JSON.stringify(customVessels));
  }, [customVessels]);

  const setEvents = useCallback((evts: ScenarioEvent[]) => {
    setApplied(false);
    setEventsState(evts);
  }, []);

  const addEvent = useCallback((event: ScenarioEvent) => {
    setApplied(false);
    setEventsState((prev) => [
      ...prev.filter((item) => !(item.type === event.type && item.target === event.target)),
      event,
    ]);
  }, []);

  const removeEvent = useCallback((id: string) => {
    setApplied(false);
    setEventsState((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addCustomVessel = useCallback((vessel: {
    vessel_id: string;
    type: VesselType;
    cargo: string;
    eta_hours: number;
    priority: VesselPriority;
  }): Vessel => {
    const newVessel: Vessel = {
      ...vessel,
      status: vessel.eta_hours <= 0 ? "Docked" : "En Route",
      assigned_berth_id: null,
      unload_duration_hours: vessel.type === "Container" ? 8 : vessel.type === "Bulk" ? 15 : 11,
      wait_time_hours: 0,
      delay_reason: null,
    };
    setCustomVessels((prev) => [...prev, newVessel]);
    setApplied(false);
    return newVessel;
  }, []);

  const importVessels = useCallback((vessels: {
    vessel_id: string;
    type: VesselType;
    cargo: string;
    eta_hours: number;
    priority: VesselPriority;
  }[]) => {
    const errors: string[] = [];
    let added = 0;
    vessels.forEach((v) => {
      const exists = customVessels.some((cv) => cv.vessel_id === v.vessel_id);
      if (exists) {
        errors.push(`${v.vessel_id} already exists`);
        return;
      }
      const newVessel: Vessel = {
        ...v,
        status: v.eta_hours <= 0 ? "Docked" : "En Route",
        assigned_berth_id: null,
        unload_duration_hours: v.type === "Container" ? 8 : v.type === "Bulk" ? 15 : 11,
        wait_time_hours: 0,
        delay_reason: null,
      };
      setCustomVessels((prev) => [...prev, newVessel]);
      added++;
    });
    setApplied(false);
    return { success: added > 0, added, errors };
  }, [customVessels]);

  const resetEvents = useCallback(() => {
    setApplied(false);
    setEventsState([]);
    localStorage.removeItem("port-events");
  }, []);

  const resetAll = useCallback(() => {
    setApplied(false);
    setEventsState([]);
    setCustomVessels([]);
    localStorage.removeItem("port-events");
    localStorage.removeItem("port-custom-vessels");
  }, []);

  const vessels = useMemo(
    () => (applied && portData ? portData.optimization.vessels_after : portData?.vessels ?? []),
    [applied, portData],
  );
  const congestion = applied && portData ? portData.optimization.after : portData?.congestion;
  const metrics = applied && portData ? portData.optimization.metrics_after : portData?.metrics;

  const addToast = useCallback((_message: string, _type?: "success" | "info" | "warning") => {}, []);

  const value = useMemo<PortState>(() => ({
    events,
    customVessels,
    applied,
    selectedVessel,
    addEvent,
    removeEvent,
    setEvents,
    setApplied,
    setSelectedVessel,
    addCustomVessel,
    importVessels,
    resetEvents,
    resetAll,
    portData,
    isPending: queryState.isPending,
    isFetching: queryState.isFetching,
    error: queryState.error,
    setPortData,
    setQueryState,
    vessels,
    congestion,
    metrics,
    addToast,
  }), [
    events, customVessels, applied, selectedVessel,
    addEvent, removeEvent, setEvents, setApplied,
    setSelectedVessel, addCustomVessel, importVessels, resetEvents, resetAll,
    portData, queryState, setPortData, setQueryState,
    vessels, congestion, metrics, addToast,
  ]);

  return <PortContext.Provider value={value}>{children}</PortContext.Provider>;
}

export function usePortState() {
  const ctx = useContext(PortContext);
  if (!ctx) throw new Error("usePortState must be used within PortProvider");
  return ctx;
}
