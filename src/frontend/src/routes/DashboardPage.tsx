import { useState } from "react";
import {
  AlertTriangle,
} from "lucide-react";
import { usePortState } from "@/lib/port/port-context";
import { KpiStrip } from "@/components/port/KpiStrip";
import { VesselTable } from "@/components/port/VesselTable";
import { AllocationTable } from "@/components/port/AllocationTable";
import { BerthUtilizationChart } from "@/components/port/BerthUtilizationChart";
import { VesselDetailSheet } from "@/components/port/VesselDetailSheet";
import { ErrorBoundary } from "@/components/port/ErrorBoundary";
import { Pill } from "@/components/port/StatusBadge";
import type { PortStatePayload } from "@/lib/port/types";

export function DashboardPage() {
<<<<<<< HEAD
  const { portData: data, isPending, error, vessels, congestion, metrics } = usePortState();
=======
  const { portData: data, isPending, error, vessels } = usePortState();
>>>>>>> 6e35b3b1bbe3441fb746ac6adec222711d593e38
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);
  const [previousCongestion, setPreviousCongestion] = useState<PortStatePayload["congestion"] | undefined>(undefined);
  const [previousMetrics, setPreviousMetrics] = useState<PortStatePayload["metrics"] | undefined>(undefined);

  if (error && !data) {
    return (
      <div className="panel flex flex-col items-center justify-center p-12">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Failed to load port data</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message || "Please refresh the page or try again"}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload page
        </button>
      </div>
    );
  }

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="panel h-28 animate-pulse bg-surface/60 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="panel h-64 animate-pulse bg-surface/60 rounded-lg" />
          <div className="panel h-64 animate-pulse bg-surface/60 rounded-lg" />
        </div>
        <div className="panel h-40 animate-pulse bg-surface/60 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        <KpiStrip
          summary={data.summary}
<<<<<<< HEAD
          congestion={congestion ?? data.congestion}
          metrics={metrics ?? data.metrics}
=======
          congestion={data.congestion}
          metrics={data.metrics}
>>>>>>> 6e35b3b1bbe3441fb746ac6adec222711d593e38
          {...(previousCongestion ? { previousCongestion } : {})}
          {...(previousMetrics ? { previousMetrics } : {})}
        />
      </ErrorBoundary>

      {data.drivers.length > 0 && (
        <section className="panel overflow-hidden">
          <header className="flex items-center gap-3 border-b border-border bg-card/50 px-5 py-4">
            <div className="flex size-9 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="size-4 text-warning" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase">
                What is driving congestion right now
              </h2>
              <p className="text-xs text-muted-foreground">
                Top factors contributing to port congestion
              </p>
            </div>
          </header>
          <ul className="divide-y divide-border/40">
            {data.drivers.slice(0, 2).map((driver) => (
              <li key={driver.title} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-primary/5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{driver.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{driver.detail}</p>
                </div>
                <div className="shrink-0">
                  <Pill variant={driver.weight >= 60 ? "danger" : driver.weight >= 30 ? "warning" : "info"}>
                    {driver.weight}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ErrorBoundary>
          <VesselTable berths={data.berths} vessels={vessels} onSelect={setSelectedVessel} />
        </ErrorBoundary>
        <ErrorBoundary>
          <AllocationTable
            berths={data.berths}
            vessels={vessels}
            optimization={data.optimization}
          />
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <BerthUtilizationChart berths={data.berths} vessels={vessels} />
      </ErrorBoundary>

      <VesselDetailSheet
        vesselId={selectedVessel}
        berths={data.berths}
        vessels={vessels}
        optimization={data.optimization}
        etaHistory={data.eta_history}
        onClose={() => setSelectedVessel(null)}
      />
    </div>
  );
}
