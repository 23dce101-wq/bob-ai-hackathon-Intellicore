import { useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { usePortState } from "@/lib/port/port-context";
import { VesselEntryForm } from "@/components/port/VesselEntryForm";
import { CSVImportPanel } from "@/components/port/CSVImportPanel";
import { BerthConfigPanel } from "@/components/port/BerthConfigPanel";
import { CustomScenarioBuilder } from "@/components/port/CustomScenarioBuilder";
import { PlanPanel } from "@/components/port/PlanPanel";
import { ErrorBoundary } from "@/components/port/ErrorBoundary";

export function ControlsPage() {
  const {
    portData: data, isPending, isFetching, error,
    events, customVessels,
    addCustomVessel, importVessels, setEvents, addToast,
  } = usePortState();

  const handleAddCustomVessel = useCallback((vessel: {
    vessel_id: string;
    type: "Container" | "Bulk" | "Tanker";
    cargo: string;
    eta_hours: number;
    priority: "standard" | "priority";
  }) => {
    addCustomVessel(vessel);
    addToast(`Added vessel: ${vessel.vessel_id}`, "success");
  }, [addCustomVessel, addToast]);

  const handleImportVessels = useCallback((vessels: {
    vessel_id: string;
    type: "Container" | "Bulk" | "Tanker";
    cargo: string;
    eta_hours: number;
    priority: "standard" | "priority";
  }[]) => {
    const result = importVessels(vessels);
    if (result.added > 0) {
      addToast(`Imported ${result.added} vessel${result.added > 1 ? "s" : ""} successfully`, "success");
    }
    if (result.errors.length > 0) {
      addToast(`${result.errors.length} vessel${result.errors.length > 1 ? "s" : ""} skipped (already exist)`, "warning");
    }
    return result;
  }, [importVessels, addToast]);

  const applyPreset = useCallback((newEvents: Parameters<typeof setEvents>[0]) => {
    setEvents(newEvents);
    addToast(`Loaded preset scenario (${newEvents.length} events)`, "success");
  }, [setEvents, addToast]);

  if (error && !data) {
    return (
      <div className="panel flex flex-col items-center justify-center p-12">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Failed to load port data</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message || "Please refresh the page or try again"}</p>
        <button onClick={() => window.location.reload()} className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">Reload page</button>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <div className="panel h-48 animate-pulse bg-surface/60 rounded-lg" />
        <div className="panel h-64 animate-pulse bg-surface/60 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel border-dashed p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase text-primary">
          Input Controls
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <ErrorBoundary>
            <VesselEntryForm
              onAdd={handleAddCustomVessel}
              existingIds={[
                ...data.vessels.map((v) => v.vessel_id),
                ...customVessels.map((v) => v.vessel_id),
              ]}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <CSVImportPanel
              onImport={handleImportVessels}
              existingIds={[
                ...data.vessels.map((v) => v.vessel_id),
                ...customVessels.map((v) => v.vessel_id),
              ]}
            />
          </ErrorBoundary>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ErrorBoundary>
            <BerthConfigPanel berths={data.berths} onApply={(newEvents) => {
              setEvents([...events, ...newEvents]);
              addToast(`Applied ${newEvents.length} berth configuration change(s)`, "success");
            }} />
          </ErrorBoundary>
          <ErrorBoundary>
            <CustomScenarioBuilder onApply={applyPreset} disabled={isFetching} />
          </ErrorBoundary>
        </div>
      </section>

      <ErrorBoundary>
        <PlanPanel events={events} customVessels={customVessels} />
      </ErrorBoundary>
    </div>
  );
}
