import { useMemo, useState } from "react";
import { Download, Search, Ship, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Vessel, Berth, VesselType } from "@/lib/port/types";
import { buildSchedule } from "@/lib/port/schedule";
import { Pill, VesselStatusBadge } from "./StatusBadge";

function downloadCSV(rows: Vessel[], schedule: ReturnType<typeof buildSchedule>) {
  const headers = ["Vessel ID", "Type", "Cargo", "ETA (h)", "Status", "Berth", "Service Start", "Service End", "Service Hours", "Wait Hours", "Priority"];
  const csvRows = rows.map((v) => {
    const entry = schedule.entries.find((e) => e.vessel_id === v.vessel_id);
    return [
      v.vessel_id,
      v.type,
      v.cargo,
      v.eta_hours,
      v.status,
      v.assigned_berth_id ?? "",
      entry?.service_start ?? "",
      entry?.service_end ?? "",
      entry?.service_hours ?? "",
      v.wait_time_hours,
      v.priority,
    ].map((cell) => `"${cell}"`).join(",");
  });
  const csv = [headers.join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vessels-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type StatusFilter = "all" | "waiting" | "docked" | "enroute" | "delayed";

// Vessel queue, sorted by ETA, with the scheduled service window for each ship.
export function VesselTable({
  berths,
  vessels,
  onSelect,
}: {
  berths: Berth[];
  vessels: Vessel[];
  onSelect: (vesselId: string) => void;
}) {
  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);
  const rows = [...vessels].sort((a, b) => a.eta_hours - b.eta_hours);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | VesselType>("all");
  const [search, setSearch] = useState("");

  const summary = useMemo(() => ({
    waiting: rows.filter((v) => v.status === "Waiting").length,
    docked: rows.filter((v) => v.status === "Docked").length,
    enroute: rows.filter((v) => v.status === "En Route").length,
    delayed: rows.filter((v) => v.wait_time_hours > 0).length,
  }), [rows]);

  const filtered = useMemo(() => rows.filter((v) => {
    if (statusFilter === "waiting" && v.status !== "Waiting") return false;
    if (statusFilter === "docked" && v.status !== "Docked") return false;
    if (statusFilter === "enroute" && v.status !== "En Route") return false;
    if (statusFilter === "delayed" && v.wait_time_hours <= 0) return false;
    if (typeFilter !== "all" && v.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.vessel_id.toLowerCase().includes(q) && !v.cargo.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, statusFilter, typeFilter, search]);

  const statusTabs: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: rows.length },
    { id: "waiting", label: "Waiting", count: summary.waiting },
    { id: "docked", label: "Docked", count: summary.docked },
    { id: "enroute", label: "En Route", count: summary.enroute },
    { id: "delayed", label: "Delayed", count: summary.delayed },
  ];

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Ship className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide uppercase">Vessel queue &amp; schedule</h2>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {rows.length} vessels · click row for details
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCSV(rows, schedule)}
          className="gap-1.5"
        >
          <Download className="size-3.5" aria-hidden /> Export
        </Button>
      </header>

      {/* Summary counts */}
      <div className="flex flex-wrap gap-2 border-b border-border/50 px-4 py-2 text-[11px]">
        <span className="text-muted-foreground">{summary.waiting} waiting</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{summary.docked} docked</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{summary.enroute} en route</span>
        <span className="text-muted-foreground">·</span>
        <span className={summary.delayed > 0 ? "font-medium text-warning" : "text-muted-foreground"}>
          {summary.delayed} delayed
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vessel ID or cargo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface/60 pl-7 pr-7 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                statusFilter === tab.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-surface/80"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-[10px] opacity-70">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "all" | VesselType)}
          className="rounded-md border border-border bg-surface/60 px-2 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All types</option>
          <option value="Container">Container</option>
          <option value="Bulk">Bulk</option>
          <option value="Tanker">Tanker</option>
        </select>
      </div>

      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Vessel</th>
              <th className="px-4 py-2.5 text-left font-medium hide-mobile">Type</th>
              <th className="px-4 py-2.5 text-left font-medium hide-mobile">Cargo</th>
              <th className="px-4 py-2.5 text-left font-medium">ETA</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5 text-center font-medium">Berth</th>
              <th className="px-4 py-2.5 text-left font-medium hide-mobile">Service window</th>
              <th className="px-4 py-2.5 text-right font-medium">Wait</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.map((vessel) => {
              const entry = schedule.entries.find((item) => item.vessel_id === vessel.vessel_id);
              return (
                <tr
                  key={vessel.vessel_id}
                  onClick={() => onSelect(vessel.vessel_id)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onSelect(vessel.vessel_id);
                  }}
                  className="cursor-pointer transition-colors hover:bg-primary/5"
                >
                  <td className="px-4 py-2.5 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="num text-sm">{vessel.vessel_id}</span>
                      {vessel.priority === "priority" && (
                        <Pill variant="warning">priority</Pill>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground hide-mobile">{vessel.type}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground hide-mobile truncate max-w-[100px]">{vessel.cargo}</td>
                  <td className="num px-4 py-2.5 text-sm">
                    <span className={vessel.eta_hours < 0 ? "text-success" : ""}>
                      {vessel.eta_hours < 0 ? `${vessel.eta_hours}h` : `+${vessel.eta_hours}h`}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <VesselStatusBadge status={vessel.status} />
                  </td>
                  <td className="num px-4 py-2.5 text-center text-sm font-semibold">{vessel.assigned_berth_id ?? "—"}</td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground hide-mobile">
                    {entry && !entry.blocked
                      ? `+${entry.service_start}h → +${entry.service_end}h`
                      : (entry?.block_reason ?? "—")}
                  </td>
                  <td className="num px-4 py-2.5 text-right">
                    {vessel.wait_time_hours > 0 ? (
                      <Pill variant="danger">{vessel.wait_time_hours}h</Pill>
                    ) : (
                      <span className="text-sm text-success">0h</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No vessels match the current filters.
          </p>
        )}
      </div>
    </section>
  );
}
