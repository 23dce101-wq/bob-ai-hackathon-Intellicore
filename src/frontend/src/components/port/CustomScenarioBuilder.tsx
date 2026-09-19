import { useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScenarioEvent, ScenarioEventType } from "@/lib/port/types";

const EVENT_TYPES: ScenarioEventType[] = [
  "berth_closure",
  "crane_outage",
  "vessel_surge",
  "severe_weather",
  "vessel_delay",
];

const EVENT_LABELS: Record<ScenarioEventType, string> = {
  berth_closure: "Berth Closure",
  crane_outage: "Crane Outage",
  vessel_surge: "Vessel Surge",
  severe_weather: "Severe Weather",
  vessel_delay: "Vessel Delay",
};

const EVENT_DESCRIPTIONS: Record<ScenarioEventType, string> = {
  berth_closure: "Close a berth for maintenance or incident",
  crane_outage: "Take cranes offline at a berth",
  vessel_surge: "Increase vessel arrivals (port-wide)",
  severe_weather: "Slow down all operations",
  vessel_delay: "Delay a specific vessel",
};

export function CustomScenarioBuilder({
  onApply,
  disabled,
}: {
  onApply: (events: ScenarioEvent[]) => void;
  disabled: boolean;
}) {
  const [events, setEvents] = useState<Omit<ScenarioEvent, "id">[]>([
    { type: "vessel_surge", target: "PORT", duration_hours: 24, magnitude: 4 },
  ]);

  const addEvent = () => {
    setEvents((prev) => [
      ...prev,
      { type: "vessel_surge", target: "PORT", duration_hours: 24, magnitude: 4 },
    ]);
  };

  const removeEvent = (index: number) => {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEvent = (index: number, field: keyof Omit<ScenarioEvent, "id">, value: string | number) => {
    setEvents((prev) => {
      const copy = [...prev];
      const current = copy[index];
      if (!current) return prev;
      copy[index] = { ...current, [field]: value } as Omit<ScenarioEvent, "id">;
      return copy;
    });
  };

  const apply = () => {
    const full: ScenarioEvent[] = events.map((e, i) => ({
      ...e,
      id: `custom-${i}-${Date.now()}`,
    }));
    onApply(full);
  };

  return (
    <section className="panel p-4">
      <header className="mb-3 flex items-center gap-2">
        <Wand2 className="size-4 text-primary" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Custom scenario builder
          </h2>
          <p className="text-xs text-muted-foreground">
            Create your own disruption events
          </p>
        </div>
      </header>

      <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        {events.map((event, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_60px_60px_auto] items-end gap-1.5 rounded-md border border-border bg-card/40 px-2.5 py-1.5 sm:grid-cols-[1fr_100px_70px_70px_auto]"
          >
            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] text-muted-foreground">Event type</label>
              <select
                value={event.type}
                onChange={(e) => updateEvent(i, "type", e.target.value as ScenarioEventType)}
                className="w-full rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-0.5 block text-[10px] text-muted-foreground">Target</label>
              <input
                type="text"
                value={event.target}
                onChange={(e) => updateEvent(i, "target", e.target.value)}
                placeholder="B1, PORT"
                className="w-full rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">Duration (h)</label>
              <input
                type="number"
                value={event.duration_hours}
                onChange={(e) => updateEvent(i, "duration_hours", Math.max(1, Number(e.target.value)))}
                min={1}
                max={168}
                className="w-full rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">Magnitude</label>
              <input
                type="number"
                value={event.magnitude}
                onChange={(e) => updateEvent(i, "magnitude", Math.max(1, Number(e.target.value)))}
                min={1}
                max={20}
                className="w-full rounded border border-border bg-surface px-1.5 py-1 text-[11px] text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={events.length <= 1}
              onClick={() => removeEvent(i)}
            >
              <Trash2 className="size-3" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addEvent}>
          <Plus className="size-3" aria-hidden /> Add event
        </Button>
        <Button size="sm" disabled={disabled || events.length === 0} onClick={apply}>
          Apply scenario
        </Button>
        <p className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
          {events.length} event{events.length !== 1 ? "s" : ""} configured
        </p>
      </div>
    </section>
  );
}
