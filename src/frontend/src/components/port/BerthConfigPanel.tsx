import { useState, useEffect } from "react";
import { Settings, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "./StatusBadge";
import type { Berth, ScenarioEvent, ScenarioEventType } from "@/lib/port/types";

interface BerthEdit {
  berth_id: string;
  status: "operational" | "closed";
  crane_count: number;
  cranes_out: number;
  duration_hours: number;
}

function berthsToEdits(berths: Berth[]): Map<string, BerthEdit> {
  const map = new Map<string, BerthEdit>();
  berths.forEach((b) =>
    map.set(b.berth_id, {
      berth_id: b.berth_id,
      status: b.status,
      crane_count: b.crane_count,
      cranes_out: b.cranes_out,
      duration_hours: 72,
    }),
  );
  return map;
}

export function BerthConfigPanel({
  berths,
  onApply,
}: {
  berths: Berth[];
  onApply: (events: ScenarioEvent[]) => void;
}) {
  const [edits, setEdits] = useState<Map<string, BerthEdit>>(() => berthsToEdits(berths));

  // Sync edits with incoming berth data (e.g. after refetch applies berth_closure / berth_reopening)
  useEffect(() => {
    setEdits((prev) => {
      const next = berthsToEdits(berths);
      // Preserve any unsaved user changes
      prev.forEach((edit, berthId) => {
        const fresh = next.get(berthId);
        if (fresh) {
          // If the backend now reflects a closure we proposed, keep duration
          if (edit.status === "closed" && fresh.status === "closed") {
            fresh.duration_hours = edit.duration_hours;
          }
          // If the backend now reflects a reopening we proposed, keep the operational status
          if (edit.status === "operational" && fresh.status === "operational") {
            fresh.cranes_out = edit.cranes_out;
          }
          // If user has pending crane changes not yet applied, keep them
          if (edit.cranes_out !== fresh.cranes_out && fresh.cranes_out === 0) {
            fresh.cranes_out = edit.cranes_out;
            fresh.duration_hours = edit.duration_hours;
          }
        }
      });
      return next;
    });
  }, [berths]);

  const updateEdit = (berthId: string, field: keyof BerthEdit, value: unknown) => {
    setEdits((prev) => {
      const copy = new Map(prev);
      const edit = { ...copy.get(berthId)!, [field]: value };
      copy.set(berthId, edit);
      return copy;
    });
  };

  const applyAllEdits = () => {
    const events: ScenarioEvent[] = [];
    let eventCounter = 0;

    edits.forEach((edit, berthId) => {
      if (edit.status === "closed") {
        events.push({
          id: `berth-config-${++eventCounter}`,
          type: "berth_closure" as ScenarioEventType,
          target: berthId,
          duration_hours: edit.duration_hours,
          magnitude: 1,
        });
      }

      if (edit.status === "operational") {
        events.push({
          id: `berth-reopen-${++eventCounter}`,
          type: "berth_reopening" as ScenarioEventType,
          target: berthId,
          duration_hours: 0,
          magnitude: 1,
        });
      }

      const original = berths.find((b) => b.berth_id === berthId);
      if (!original) return;

      if (edit.cranes_out > original.cranes_out) {
        events.push({
          id: `crane-config-${++eventCounter}`,
          type: "crane_outage" as ScenarioEventType,
          target: berthId,
          duration_hours: edit.duration_hours,
          magnitude: edit.cranes_out,
        });
      }
    });

    if (events.length > 0) {
      onApply(events);
    }
  };

  const resetAll = () => {
    setEdits(berthsToEdits(berths));
  };

  const hasChanges = berths.some((b) => {
    const edit = edits.get(b.berth_id);
    return (
      edit &&
      (edit.status !== b.status ||
        edit.crane_count !== b.crane_count ||
        edit.cranes_out !== b.cranes_out)
    );
  });

  return (
    <section className="panel p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-primary" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Configure berths
            </h2>
            <p className="text-xs text-muted-foreground">
              Adjust berth status and crane counts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="size-3" aria-hidden /> Reset
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-2">
        {berths.map((berth) => {
          const edit = edits.get(berth.berth_id)!;
          const changed =
            edit.status !== berth.status ||
            edit.crane_count !== berth.crane_count ||
            edit.cranes_out !== berth.cranes_out;

          return (
            <div
              key={berth.berth_id}
              className={`flex flex-wrap items-center gap-3 rounded-md border p-3 transition-colors ${
                changed ? "border-primary/50 bg-primary/5" : "border-border"
              }`}
            >
              <div className="w-20 shrink-0">
                <p className="num text-sm font-medium">{berth.berth_id}</p>
                <Pill variant={berth.status === "operational" ? "success" : "danger"}>
                  {berth.status}
                </Pill>
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-4">
                <div>
                  <label className="mb-1 block text-[0.65rem] text-muted-foreground">
                    Status
                  </label>
                  <select
                    value={edit.status}
                    onChange={(e) =>
                      updateEdit(berth.berth_id, "status", e.target.value as "operational" | "closed")
                    }
                    className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="operational">Operational</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[0.65rem] text-muted-foreground">
                    Total cranes
                  </label>
                  <input
                    type="number"
                    value={edit.crane_count}
                    onChange={(e) =>
                      updateEdit(berth.berth_id, "crane_count", Math.max(0, Number(e.target.value)))
                    }
                    min={0}
                    max={10}
                    className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[0.65rem] text-muted-foreground">
                    Cranes down
                  </label>
                  <input
                    type="number"
                    value={edit.cranes_out}
                    onChange={(e) =>
                      updateEdit(berth.berth_id, "cranes_out", Math.max(0, Number(e.target.value)))
                    }
                    min={0}
                    max={edit.crane_count}
                    className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">
                    {edit.crane_count - edit.cranes_out}
                  </span>{" "}
                  effective cranes
                </div>

                <div>
                  <label className="mb-1 block text-[0.65rem] text-muted-foreground">
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    value={edit.duration_hours}
                    onChange={(e) =>
                      updateEdit(berth.berth_id, "duration_hours", Math.max(1, Number(e.target.value)))
                    }
                    min={1}
                    max={72}
                    className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={!changed}
                onClick={() => {
                  const edit = edits.get(berth.berth_id);
                  if (edit) {
                    const events: ScenarioEvent[] = [];
                    if (edit.status === "closed") {
                      events.push({
                        id: `berth-config-${berth.berth_id}`,
                        type: "berth_closure" as ScenarioEventType,
                        target: berth.berth_id,
                        duration_hours: edit.duration_hours,
                        magnitude: 1,
                      });
                    }
                    if (edit.status === "operational") {
                      events.push({
                        id: `berth-reopen-${berth.berth_id}`,
                        type: "berth_reopening" as ScenarioEventType,
                        target: berth.berth_id,
                        duration_hours: 0,
                        magnitude: 1,
                      });
                    }
                    const original = berths.find((b) => b.berth_id === berth.berth_id);
                    if (original && edit.cranes_out > original.cranes_out) {
                      events.push({
                        id: `crane-config-${berth.berth_id}`,
                        type: "crane_outage" as ScenarioEventType,
                        target: berth.berth_id,
                        duration_hours: edit.duration_hours,
                        magnitude: edit.cranes_out,
                      });
                    }
                    if (events.length > 0) onApply(events);
                  }
                }}
              >
                <Save className="size-3" aria-hidden /> Apply
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
