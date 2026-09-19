import { AlertTriangle } from "lucide-react";
import { usePortState } from "@/lib/port/port-context";
import { PortSimulation } from "@/components/port/PortSimulation";
import { YardPanel } from "@/components/port/YardPanel";
import { ErrorBoundary } from "@/components/port/ErrorBoundary";

export function SimulationPage() {
  const { portData: data, isPending, error, vessels, events, applied } = usePortState();

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
        <div className="panel h-[calc(100vh-200px)] animate-pulse bg-surface/60 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <PortSimulation
          berths={data.berths}
          vessels={vessels}
          yard={data.yard}
          events={events}
          {...(applied ? { optimization: data.optimization } : {})}
        />
      </ErrorBoundary>

      {data.yard && (
        <ErrorBoundary>
          <YardPanel yard={data.yard} />
        </ErrorBoundary>
      )}
    </div>
  );
}
