import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScenarioEvent, Vessel } from "@/lib/port/types";
import { SimpleMarkdown } from "./SimpleMarkdown";


export function PlanPanel({ events, customVessels }: { events: ScenarioEvent[]; customVessels: Vessel[] }) {
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setPlan("");
    try {
      const API = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API}/api/ai/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events,
          custom_vessels: customVessels.map((v) => ({
            vessel_id: v.vessel_id,
            type: v.type,
            cargo: v.cargo,
            eta_hours: v.eta_hours,
            priority: v.priority,
          })),
        }),
      });
      if (!res.ok || !res.body) {
        setError((await res.text()) || "Could not generate the plan.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setPlan(acc);
      }
    } catch {
      setError("Network problem while generating the plan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel flex flex-col p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">72-hour operations plan</h2>
          <p className="text-xs text-muted-foreground">
            AI-written shift plan from the current hotspots and reassignments
          </p>
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          Generate 72-hour plan
        </Button>
      </header>

      <div className="max-h-96 min-h-24 overflow-auto rounded-md border border-border bg-surface/60 p-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !plan && !loading && (
          <p className="text-sm text-muted-foreground">
            No plan generated yet. Close a berth first to see the optimiser react.
          </p>
        )}
        {!error && loading && !plan && (
          <p className="text-sm text-muted-foreground">Thinking through the schedule…</p>
        )}
        {plan && <SimpleMarkdown text={plan} />}
      </div>
    </section>
  );
}
