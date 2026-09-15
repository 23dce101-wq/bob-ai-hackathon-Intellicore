import { useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { usePortState } from "@/lib/port/port-context";
import { CopilotChat } from "@/components/port/CopilotChat";
import { PresetScenarios } from "@/components/port/PresetScenarios";
import { ScenarioPanel } from "@/components/port/ScenarioPanel";
import { ErrorBoundary } from "@/components/port/ErrorBoundary";

export function CopilotPage() {
  const {
    portData: data, isPending, isFetching, error,
    events, customVessels, applied, vessels,
    addEvent, removeEvent, setEvents, addToast,
  } = usePortState();

  const addEventWithToast = useCallback((event: Parameters<typeof addEvent>[0]) => {
    addEvent(event);
    addToast(`Applied: ${event.type} on ${event.target}`, "warning");
  }, [addEvent, addToast]);

  const removeEventWithToast = useCallback((id: string) => {
    removeEvent(id);
    addToast("Event removed", "info");
  }, [removeEvent, addToast]);

  const applyPreset = useCallback((newEvents: Parameters<typeof setEvents>[0]) => {
    setEvents(newEvents);
    addToast(`Loaded preset scenario (${newEvents.length} events)`, "success");
  }, [setEvents, addToast]);

  const resetEvents = useCallback(() => {
    setEvents([]);
    addToast("Disruption events cleared", "info");
  }, [setEvents, addToast]);

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <div className="panel h-64 animate-pulse bg-surface/60 rounded-lg" />
        <div className="panel h-48 animate-pulse bg-surface/60 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel flex flex-col items-center justify-center p-12">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Failed to load port data</p>
        <p className="mt-1 text-xs text-muted-foreground">Please refresh the page or try again</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <CopilotChat
          events={events}
          customVessels={customVessels}
          applied={applied}
          congestion={data.congestion}
          vessels={vessels}
          {...(applied ? { optimization: data.optimization } : {})}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <PresetScenarios
          onApply={applyPreset}
          disabled={isFetching}
          vesselIds={data.vessels.map((v) => v.vessel_id)}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <ScenarioPanel
          berths={data.berths}
          vessels={data.vessels}
          events={events}
          impact={data.scenario}
          onAdd={addEventWithToast}
          onRemove={removeEventWithToast}
          onReset={resetEvents}
          pending={isFetching}
        />
      </ErrorBoundary>
    </div>
  );
}
