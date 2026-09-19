import { Flame, CloudLightning, Ship, Wrench, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScenarioEvent } from "@/lib/port/types";

interface PresetScenario {
  id: string;
  label: string;
  description: string;
  icon: typeof Flame;
  events: Omit<ScenarioEvent, "id">[] | ((vesselIds: string[]) => Omit<ScenarioEvent, "id">[]);
}

const PRESETS: PresetScenario[] = [
  {
    id: "la-backlog",
    label: "2021 LA Backlog",
    description: "Recreates the 100+ vessel backlog: surge arrivals + berth closures + crane outages",
    icon: Ship,
    events: () => [
      { type: "vessel_surge", target: "PORT", duration_hours: 48, magnitude: 8 },
      { type: "berth_closure", target: "B3", duration_hours: 24, magnitude: 1 },
      { type: "crane_outage", target: "B1", duration_hours: 16, magnitude: 2 },
    ],
  },
  {
    id: "hurricane",
    label: "Hurricane Alert",
    description: "Severe weather forces all vessels to reduce speed and handling slows 30%",
    icon: CloudLightning,
    events: (vesselIds: string[]) => {
      const v1 = vesselIds[2] ?? "V103";
      const v2 = vesselIds[6] ?? "V107";
      return [
        { type: "severe_weather", target: "PORT", duration_hours: 36, magnitude: 1 },
        { type: "vessel_delay", target: v1, duration_hours: 12, magnitude: 8 },
        { type: "vessel_delay", target: v2, duration_hours: 12, magnitude: 6 },
      ];
    },
  },
  {
    id: "crane-failure",
    label: "Crane Emergency",
    description: "Multiple crane failures across berths create cascading delays",
    icon: Wrench,
    events: () => [
      { type: "crane_outage", target: "B2", duration_hours: 20, magnitude: 3 },
      { type: "crane_outage", target: "B5", duration_hours: 12, magnitude: 2 },
      { type: "vessel_surge", target: "PORT", duration_hours: 24, magnitude: 4 },
    ],
  },
  {
    id: "mixed-crisis",
    label: "Compound Crisis",
    description: "Everything at once: storm, crane failure, and vessel surge",
    icon: Flame,
    events: () => [
      { type: "severe_weather", target: "PORT", duration_hours: 18, magnitude: 1 },
      { type: "berth_closure", target: "B4", duration_hours: 24, magnitude: 1 },
      { type: "crane_outage", target: "B6", duration_hours: 16, magnitude: 2 },
      { type: "vessel_surge", target: "PORT", duration_hours: 36, magnitude: 6 },
    ],
  },
];

export function PresetScenarios({
  onApply,
  disabled,
  vesselIds = [],
}: {
  onApply: (events: ScenarioEvent[]) => void;
  disabled: boolean;
  vesselIds?: string[];
}) {
  const apply = (preset: PresetScenario) => {
    const eventDefs = typeof preset.events === "function"
      ? preset.events(vesselIds)
      : preset.events;
    const events: ScenarioEvent[] = eventDefs.map((e, i) => ({
      ...e,
      id: `${preset.id}-${i}-${Date.now()}`,
    }));
    onApply(events);
  };

  return (
    <section className="panel p-4">
      <header className="mb-3 flex items-center gap-2">
        <Zap className="size-4 text-primary" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Preset demo scenarios
          </h2>
          <p className="text-xs text-muted-foreground">
            One-click crisis injection for live demos and judge presentations
          </p>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => apply(preset)}
              className="flex items-start gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-secondary/40 disabled:opacity-50"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {preset.description}
                </p>
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  {typeof preset.events === "function" ? "Dynamic" : preset.events.length} events
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
