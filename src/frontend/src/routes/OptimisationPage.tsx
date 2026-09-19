<<<<<<< HEAD
import { useState, useCallback } from "react";
=======
import { useCallback } from "react";
>>>>>>> 6e35b3b1bbe3441fb746ac6adec222711d593e38
import { AlertTriangle } from "lucide-react";
import { usePortState } from "@/lib/port/port-context";
import { ForecastPanel } from "@/components/port/ForecastPanel";
import { OptimizationPanel } from "@/components/port/OptimizationPanel";
import { GanttPlan } from "@/components/port/GanttPlan";
import { MacroRoutingPanel } from "@/components/port/MacroRoutingPanel";
import { CraneRebalancePanel } from "@/components/port/CraneRebalancePanel";
import { ErrorBoundary } from "@/components/port/ErrorBoundary";

export function OptimisationPage() {
<<<<<<< HEAD
  const { portData: data, isPending, isFetching, error, vessels, applied, setApplied, applyOptimization, addToast } = usePortState();
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = useCallback(async () => {
    setIsApplying(true);
    const res = await applyOptimization();
    setIsApplying(false);
    if (res.success) {
      addToast(res.message || "Optimisation applied — plan updated", "success");
    } else {
      addToast(`Failed to apply optimisation: ${res.error || "Unknown error"}`, "warning");
    }
  }, [applyOptimization, addToast]);
=======
  const { portData: data, isPending, isFetching, error, vessels, applied, setApplied, addToast } = usePortState();

  const handleApply = useCallback(() => {
    setApplied(true);
    addToast("Optimisation applied — plan updated", "success");
  }, [setApplied, addToast]);
>>>>>>> 6e35b3b1bbe3441fb746ac6adec222711d593e38

  const handleRevert = useCallback(() => {
    setApplied(false);
    addToast("Reverted to original plan", "info");
  }, [setApplied, addToast]);

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
      {applied && (
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4 text-center">
            <p className="num text-2xl font-bold text-success">{data.optimization.hours_saved_total}h</p>
            <p className="text-xs text-muted-foreground">Total waiting time saved</p>
          </div>
          <div className="panel p-4 text-center">
            <p className="num text-2xl font-bold text-success">{data.optimization.fuel_saved_total_tons}t</p>
            <p className="text-xs text-muted-foreground">Fuel saved</p>
          </div>
          <div className="panel p-4 text-center">
            <p className="num text-2xl font-bold text-success">{data.optimization.co2_saved_total_tons}t</p>
            <p className="text-xs text-muted-foreground">CO₂ emissions avoided</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ErrorBoundary>
          <ForecastPanel prediction={data.prediction} berths={data.berths} vessels={vessels} />
        </ErrorBoundary>
        <ErrorBoundary>
          <OptimizationPanel
            optimization={data.optimization}
            applied={applied}
            onApply={handleApply}
            onRevert={handleRevert}
            pending={isFetching}
<<<<<<< HEAD
            isApplying={isApplying}
=======
>>>>>>> 6e35b3b1bbe3441fb746ac6adec222711d593e38
          />
        </ErrorBoundary>
      </div>

      <ErrorBoundary>
        <GanttPlan berths={data.berths} vessels={vessels} {...(applied ? { optimization: data.optimization } : {})} />
      </ErrorBoundary>

      {data.macro_routing && data.macro_routing.length > 0 && (
        <ErrorBoundary>
          <MacroRoutingPanel advice={data.macro_routing} />
        </ErrorBoundary>
      )}

      {data.crane_rebalance && data.crane_rebalance.length > 0 && (
        <ErrorBoundary>
          <CraneRebalancePanel moves={data.crane_rebalance} />
        </ErrorBoundary>
      )}
    </div>
  );
}
