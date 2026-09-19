import { ArrowRight, CheckCircle, Undo2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OptimizationResult } from "@/lib/port/types";
import { LevelBadge, Pill } from "./StatusBadge";

function Delta({ before, after, unit = "" }: { before: number; after: number; unit?: string }) {
  if (before === after) {
    return (
      <span className="flex items-center gap-1.5 text-sm">
        <span className="num text-muted-foreground">{before}{unit}</span>
        <CheckCircle className="size-3.5 text-success" />
        <span className="text-[11px] text-success font-medium">Already optimal</span>
      </span>
    );
  }
  const improved = after < before;
  return (
    <span className="num flex items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">
        {before}
        {unit}
      </span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
      <span className={improved ? "text-success" : "text-foreground"}>
        {after}
        {unit}
      </span>
    </span>
  );
}

// Before/after allocation optimiser, with the reasoning behind every move.
export function OptimizationPanel({
  optimization,
  applied,
  onApply,
  onRevert,
  pending,
}: {
  optimization: OptimizationResult;
  applied: boolean;
  onApply: () => void;
  onRevert: () => void;
  pending: boolean;
}) {
  const { before, after, metrics_before, metrics_after, moves, unresolved } = optimization;

  return (
    <section className="panel p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Optimised berth allocation
          </h2>
          <p className="text-xs text-muted-foreground">
            Greedy reassignment — each delayed vessel moves to the soonest-free compatible berth
          </p>
        </div>
        {applied ? (
          <Button variant="outline" onClick={onRevert} disabled={pending}>
            <Undo2 className="size-4" aria-hidden /> Revert to original plan
          </Button>
        ) : (
          <Button onClick={onApply} disabled={pending || moves.length === 0}>
            <Wand2 className="size-4" aria-hidden /> Apply optimised plan
          </Button>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface/60 p-3 text-xs lg:grid-cols-5">
        <div>
          <dt className="text-muted-foreground">Conflicts</dt>
          <dd className="mt-1">
            <Delta before={before.hotspots.length} after={after.hotspots.length} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Congestion score</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            <Delta before={before.port_score} after={after.port_score} />
            <LevelBadge level={after.port_level} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Avg wait</dt>
          <dd className="mt-1">
            <Delta before={metrics_before.avg_wait_hours} after={metrics_after.avg_wait_hours} unit="h" />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Delayed vessels</dt>
          <dd className="mt-1">
            <Delta
              before={metrics_before.delayed_vessel_count}
              after={metrics_after.delayed_vessel_count}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Waiting time saved</dt>
          <dd className="num mt-1 text-sm text-success">{optimization.hours_saved_total}h</dd>
        </div>
      </dl>

      <div className="mt-3 max-h-80 space-y-2 overflow-auto">
        {moves.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No beneficial reassignment found — the current allocation is already the best this
            heuristic can do.
          </p>
        )}
        {moves.map((move) => (
          <article key={move.vessel_id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-sm font-medium">{move.vessel_id}</span>
              <Pill variant="info">
                {move.from_berth_id ?? "unassigned"} → {move.to_berth_id}
              </Pill>
              <Pill variant="success">saves {move.hours_saved}h</Pill>
              <span className="num text-xs text-muted-foreground">
                wait {move.wait_before_hours}h → {move.wait_after_hours}h · {move.cranes_assigned}{" "}
                cranes
              </span>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {move.reason_lines.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {unresolved.length > 0 && (
        <div className="mt-3 text-xs text-warning">
          <p>
            {unresolved.length} vessel{unresolved.length > 1 ? "s" : ""} could not be improved — no compatible berth frees up any sooner.
          </p>
          {unresolved.length <= 10 ? (
            <p className="mt-1 text-muted-foreground">{unresolved.join(", ")}</p>
          ) : (
            <details className="mt-1">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Show {unresolved.length} vessel IDs
              </summary>
              <p className="mt-1 text-muted-foreground">{unresolved.join(", ")}</p>
            </details>
          )}
        </div>
      )}
      {applied && (
        <p className="mt-3 text-xs text-success">
          Optimised plan applied — the port view, Gantt plan, forecast and tables all reflect it.
        </p>
      )}
    </section>
  );
}
