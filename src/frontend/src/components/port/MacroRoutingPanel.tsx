import { useState, useMemo } from "react";
import { Compass, Fuel, ArrowRight, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { MacroRoutingAdvice } from "@/lib/port/types";
import { Pill } from "./StatusBadge";

const STRATEGY_LABELS: Record<string, { label: string; color: string }> = {
  slow_steaming: { label: "Slow Steaming", color: "info" },
  offshore_holding: { label: "Offshore Holding", color: "warning" },
  divert_secondary_port: { label: "Divert to Secondary", color: "danger" },
  advance_booking: { label: "Advance Booking", color: "success" },
};

const STRATEGY_PRIORITY: Record<string, number> = {
  divert_secondary_port: 0,
  slow_steaming: 1,
  offshore_holding: 2,
  advance_booking: 3,
};

const COLLAPSED_COUNT = 3;

export function MacroRoutingPanel({ advice }: { advice: MacroRoutingAdvice[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...advice].sort((a, b) => (STRATEGY_PRIORITY[a.strategy] ?? 4) - (STRATEGY_PRIORITY[b.strategy] ?? 4)),
    [advice],
  );

  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_COUNT);

  return (
    <section className="panel w-full">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <Compass className="size-4 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Macro-routing strategies
            </h2>
            <p className="text-xs text-muted-foreground">
              Offshore diversions, slow-steaming advisories and secondary port recommendations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Pill variant="info">{advice.length} advisories</Pill>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>Collapse <ChevronUp className="size-3.5" /></>
            ) : (
              <>Expand all <ChevronDown className="size-3.5" /></>
            )}
          </button>
        </div>
      </header>

      {advice.length === 0 ? (
        <p className="px-5 pb-4 text-xs text-muted-foreground">
          No macro-routing advisories — congestion is within normal bounds.
        </p>
      ) : (
        <div className="border-t border-border divide-y divide-border/50">
          {visible.map((item) => {
            const strategy = STRATEGY_LABELS[item.strategy] ?? { label: item.strategy, color: "info" };
            const isItemExpanded = expandedItem === `${item.vessel_id}-${item.strategy}`;
            return (
              <button
                key={`${item.vessel_id}-${item.strategy}`}
                onClick={() => setExpandedItem(isItemExpanded ? null : `${item.vessel_id}-${item.strategy}`)}
                className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-surface/40"
                aria-expanded={isItemExpanded}
              >
                <span className="num text-sm font-semibold min-w-[52px]">{item.vessel_id}</span>
                <Pill variant={strategy.color as "info" | "warning" | "danger" | "success"}>
                  {strategy.label}
                </Pill>
                {item.time_impact_hours !== 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden />
                    {item.time_impact_hours > 0 ? "+" : ""}{item.time_impact_hours}h
                  </span>
                )}
                {item.fuel_savings_kg !== null && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Fuel className="size-3" aria-hidden />
                    {item.fuel_savings_kg >= 1000
                      ? `Save ~${(item.fuel_savings_kg / 1000).toFixed(1)}t`
                      : `Save ~${item.fuel_savings_kg}kg`}
                  </span>
                )}
                {item.target_port && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowRight className="size-3" aria-hidden />
                    {item.target_port}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {isItemExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!expanded && sorted.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface/40 hover:text-foreground"
        >
          Show all {sorted.length} advisories <ChevronDown className="size-3.5" />
        </button>
      )}

      {expanded && sorted.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded(false)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface/40 hover:text-foreground"
        >
          Show fewer <ChevronUp className="size-3.5" />
        </button>
      )}
    </section>
  );
}
