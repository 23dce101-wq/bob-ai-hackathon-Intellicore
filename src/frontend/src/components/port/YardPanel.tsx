import { useState } from "react";
import { ChevronDown, ChevronUp, Warehouse } from "lucide-react";
import type { YardStatus } from "@/lib/port/types";
import { LevelBadge, Pill } from "./StatusBadge";

export function YardPanel({ yard }: { yard: YardStatus }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="panel">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-surface/40"
      >
        <div className="flex items-center gap-2">
          <Warehouse className="size-4 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Container yard status
            </h2>
            <p className="text-xs text-muted-foreground">
              TEU occupancy, yard block saturation and RTG crane availability
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill variant={yard.level === "critical" ? "danger" : yard.level === "high" ? "warning" : "info"}>
            {yard.utilization_pct}% occupied
          </Pill>
          <LevelBadge level={yard.level} />
          {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <dl className="mb-3 grid grid-cols-3 gap-3 rounded-md border border-border bg-surface/60 p-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Total TEU capacity</dt>
              <dd className="mt-1 num text-base font-semibold">{yard.total_teu.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Used TEU slots</dt>
              <dd className="mt-1 num text-base font-semibold">{yard.used_teu.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">RTG availability</dt>
              <dd className="mt-1 num text-base font-semibold">{yard.rtg_availability_pct}%</dd>
            </div>
          </dl>

          <div className="space-y-1.5">
            {yard.blocks.map((block) => {
              const pct = block.total_teu ? Math.round((block.used_teu / block.total_teu) * 100) : 0;
              const saturated = pct >= 90;
              return (
                <div
                  key={block.block_id}
                  className="flex items-center gap-3 rounded-md border border-border p-2.5"
                >
                  <div className="w-14 shrink-0">
                    <p className="num text-xs font-medium">{block.block_id}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {block.serving_berths.join(", ")}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="num text-muted-foreground">
                        {block.used_teu.toLocaleString()} / {block.total_teu.toLocaleString()} TEU
                      </span>
                      <span className={saturated ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${saturated ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
                    <p>{block.rtg_count} RTG{block.rtg_count > 1 ? "s" : ""}</p>
                    <p className={block.rtg_operational ? "text-success" : "text-destructive"}>
                      {block.rtg_operational ? "OK" : "Degraded"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
