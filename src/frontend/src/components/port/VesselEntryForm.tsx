import { useState } from "react";
import { Plus, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VesselType, VesselPriority } from "@/lib/port/types";

interface VesselFormData {
  vessel_id: string;
  type: VesselType;
  cargo: string;
  eta_hours: number;
  priority: VesselPriority;
}

const VESSEL_TYPES: VesselType[] = ["Container", "Bulk", "Tanker"];
const PRIORITY_OPTIONS: VesselPriority[] = ["standard", "priority"];

export function VesselEntryForm({
  onAdd,
  existingIds,
}: {
  onAdd: (vessel: VesselFormData) => void;
  existingIds: string[];
}) {
  const [form, setForm] = useState<VesselFormData>({
    vessel_id: "",
    type: "Container",
    cargo: "",
    eta_hours: 24,
    priority: "standard",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const id = form.vessel_id.trim();
    if (!id) {
      setError("Vessel ID is required");
      return;
    }
    if (existingIds.includes(id)) {
      setError(`Vessel ${id} already exists`);
      return;
    }
    if (form.eta_hours < -12 || form.eta_hours > 168) {
      setError("ETA must be between -12h and 168h");
      return;
    }

    onAdd({ ...form, vessel_id: id });
    setForm({ vessel_id: "", type: "Container", cargo: "", eta_hours: 24, priority: "standard" });
  };

  return (
    <section className="panel p-4">
      <header className="mb-3 flex items-center gap-2">
        <Ship className="size-4 text-primary" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Add custom vessel
          </h2>
          <p className="text-xs text-muted-foreground">
            Manually inject a vessel into the simulation
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Vessel ID *</label>
            <input
              type="text"
              value={form.vessel_id}
              onChange={(e) => setForm({ ...form, vessel_id: e.target.value })}
              placeholder="e.g. V200"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as VesselType })}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {VESSEL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Cargo *</label>
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              placeholder="e.g. Electronics, Grain, Crude"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ETA (hours from now) *</label>
            <input
              type="number"
              value={form.eta_hours}
              onChange={(e) => setForm({ ...form, eta_hours: Number(e.target.value) })}
              min={-12}
              max={168}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as VesselPriority })}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" size="sm">
          <Plus className="size-4" aria-hidden /> Add vessel
        </Button>
      </form>
    </section>
  );
}
