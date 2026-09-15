import { ArrowRightLeft } from "lucide-react";
import type { CraneRebalanceMove } from "@/lib/port/types";
import { Pill } from "./StatusBadge";

export function CraneRebalancePanel({ moves }: { moves: CraneRebalanceMove[] }) {
  return (
    <section className="panel p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="size-4 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Dynamic crane rebalancing
            </h2>
            <p className="text-xs text-muted-foreground">
              Move unused cranes from idle berths to congested ones in real-time
            </p>
          </div>
        </div>
        <Pill variant="info">{moves.length} moves</Pill>
      </header>

      <div className="max-h-60 space-y-2 overflow-auto">
        {moves.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No crane rebalancing needed — crane distribution is adequate across berths.
          </p>
        )}
        {moves.map((move, idx) => (
          <article
            key={`${move.from_berth_id}-${move.to_berth_id}-${idx}`}
            className="rounded-md border border-border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Pill variant="info">{move.cranes_moved} crane{move.cranes_moved > 1 ? "s" : ""}</Pill>
              <span className="flex items-center gap-1 text-sm">
                <span className="num font-medium">{move.from_berth_id}</span>
                <ArrowRightLeft className="size-3 text-muted-foreground" aria-hidden />
                <span className="num font-medium">{move.to_berth_id}</span>
              </span>
              <Pill variant="success">~{move.congestion_reduction_estimate}% score reduction</Pill>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{move.reason}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
