import { useState } from "react";
import { CloudLightning, Plus, RotateCcw, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Berth,
  ScenarioEvent,
  ScenarioEventType,
  ScenarioImpact,
  Vessel,
} from "@/lib/port/types";
import { LevelBadge, Pill } from "./StatusBadge";

const TYPES: { value: ScenarioEventType; label: string; magnitudeLabel: string | null }[] = [
  { value: "berth_closure", label: "Close a berth", magnitudeLabel: null },
  { value: "crane_outage", label: "Crane outage", magnitudeLabel: "Cranes down" },
  { value: "vessel_surge", label: "Unscheduled vessel surge", magnitudeLabel: "Extra vessels" },
  { value: "severe_weather", label: "Severe weather", magnitudeLabel: null },
  { value: "vessel_delay", label: "Delay a vessel", magnitudeLabel: "Delay hours" },
];

const selectClass =
  "h-9 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

// Disruption simulation: build a scenario, apply it, see the whole port react.
export function ScenarioPanel({
  berths,
  vessels,
  events,
  impact,
  onAdd,
  onRemove,
  onReset,
  pending,
}: {
  berths: Berth[];
  vessels: Vessel[];
  events: ScenarioEvent[];
  impact: ScenarioImpact;
  onAdd: (event: ScenarioEvent) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  pending: boolean;
}) {
  const [type, setType] = useState<ScenarioEventType>("berth_closure");
  const [target, setTarget] = useState(berths[0]?.berth_id ?? "B1");
  const [duration, setDuration] = useState(12);
  const [magnitude, setMagnitude] = useState(2);

  const needsBerth = type === "berth_closure" || type === "crane_outage";
  const needsVessel = type === "vessel_delay";
  const spec = TYPES.find((item) => item.value === type)!;

  const add = (event: Omit<ScenarioEvent, "id">) => {
    onAdd({ ...event, id: `${event.type}-${event.target}-${Date.now()}` });
  };

  const affectedLabel = impact.affected_vessel_ids.length
    ? impact.affected_vessel_ids.slice(0, 8).join(", ") +
      (impact.affected_vessel_ids.length > 8 ? "…" : "")
    : "none";

  return (
    <section className="panel p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CloudLightning className="size-4 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">Simulate a disruption</h2>
            <p className="text-xs text-muted-foreground">
              Everything on this page recalculates from the scenario below
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} disabled={pending || !events.length}>
          <RotateCcw className="size-4" aria-hidden /> Reset port
        </Button>
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            add({ type: "berth_closure", target: "B3", duration_hours: 12, magnitude: 1 })
          }
        >
          <Zap className="size-3.5" aria-hidden /> Close B3 for 12h
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => add({ type: "crane_outage", target: "B1", duration_hours: 8, magnitude: 2 })}
        >
          <Zap className="size-3.5" aria-hidden /> 2 cranes down at B1
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => add({ type: "vessel_surge", target: "PORT", duration_hours: 24, magnitude: 4 })}
        >
          <Zap className="size-3.5" aria-hidden /> Surge: +4 vessels
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() =>
            add({ type: "severe_weather", target: "PORT", duration_hours: 12, magnitude: 1 })
          }
        >
          <Zap className="size-3.5" aria-hidden /> Storm for 12h
        </Button>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-surface/60 p-3 sm:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          Event
          <select
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value as ScenarioEventType)}
          >
            {TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground">
          Target
          <select
            className={selectClass}
            value={needsBerth || needsVessel ? target : "PORT"}
            disabled={!needsBerth && !needsVessel}
            onChange={(e) => setTarget(e.target.value)}
          >
            {needsBerth &&
              berths.map((berth) => (
                <option key={berth.berth_id} value={berth.berth_id}>
                  {berth.berth_id} ({berth.crane_count} cranes)
                </option>
              ))}
            {needsVessel &&
              vessels.map((vessel) => (
                <option key={vessel.vessel_id} value={vessel.vessel_id}>
                  {vessel.vessel_id} · {vessel.type} · +{vessel.eta_hours}h
                </option>
              ))}
            {!needsBerth && !needsVessel && <option value="PORT">Whole port</option>}
          </select>
        </label>

        <label className="text-xs text-muted-foreground">
          Duration (h)
          <input
            type="number"
            min={1}
            max={72}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={selectClass}
          />
        </label>

        <label className="text-xs text-muted-foreground">
          {spec.magnitudeLabel ?? "Intensity"}
          <input
            type="number"
            min={1}
            max={12}
            value={magnitude}
            disabled={!spec.magnitudeLabel}
            onChange={(e) => setMagnitude(Number(e.target.value))}
            className={selectClass}
          />
        </label>

        <div className="sm:col-span-4">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              add({
                type,
                target: needsBerth || needsVessel ? target : "PORT",
                duration_hours: Math.max(1, Math.min(72, duration)),
                magnitude: Math.max(1, Math.min(12, magnitude)),
              })
            }
          >
            <Plus className="size-4" aria-hidden /> Apply event
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase">Active scenario</h3>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Normal operations — no disruption applied. Add an event to stress-test the plan.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <span>
                  <span className="font-medium">
                    {TYPES.find((item) => item.value === event.type)?.label ?? event.type}
                  </span>{" "}
                  <span className="num text-muted-foreground">
                    · {event.target} · {event.duration_hours}h
                    {event.magnitude > 1 ? ` · ×${event.magnitude}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(event.id)}
                  aria-label={`Remove ${event.type} on ${event.target}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {events.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-3 rounded-md border border-border bg-surface/60 p-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Baseline score</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="num text-base">{impact.baseline_score}</span>
              <LevelBadge level={impact.baseline_level} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">With scenario</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="num text-base">{impact.scenario_score}</span>
              <LevelBadge level={impact.scenario_level} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Extra waiting time</dt>
            <dd className="num mt-1 text-base">
              {impact.added_wait_hours > 0 ? `+${impact.added_wait_hours}h` : `${impact.added_wait_hours}h`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vessels affected</dt>
            <dd className="mt-1">
              <Pill variant={impact.affected_vessel_ids.length ? "danger" : "success"}>
                {impact.affected_vessel_ids.length}
              </Pill>
              <p className="num mt-1 text-[0.7rem] break-words text-muted-foreground">
                {affectedLabel}
              </p>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
