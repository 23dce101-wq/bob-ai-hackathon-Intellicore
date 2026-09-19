import { useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type {
  Berth,
  EtaHistoryEntry,
  OptimizationResult,
  Vessel,
} from "@/lib/port/types";
import { buildSchedule } from "@/lib/port/schedule";
import { Pill, VesselStatusBadge } from "./StatusBadge";

// Full record for one vessel: schedule, ETA history and any reassignment.
export function VesselDetailSheet({
  vesselId,
  berths,
  vessels,
  optimization,
  etaHistory,
  onClose,
}: {
  vesselId: string | null;
  berths: Berth[];
  vessels: Vessel[];
  optimization: OptimizationResult;
  etaHistory: EtaHistoryEntry[];
  onClose: () => void;
}) {
  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);
  const vessel = vessels.find((item) => item.vessel_id === vesselId);
  const entry = schedule.entries.find((item) => item.vessel_id === vesselId);
  const berth = berths.find((item) => item.berth_id === entry?.berth_id);
  const move = optimization.moves.find((item) => item.vessel_id === vesselId);
  const history = etaHistory.find((item) => item.vessel_id === vesselId);
  const queueAhead = entry
    ? schedule.entries.filter(
        (item) =>
          item.berth_id === entry.berth_id &&
          item.service_start !== null &&
          entry.service_start !== null &&
          item.service_start < entry.service_start,
      )
    : [];

  return (
    <Sheet open={Boolean(vesselId && vessel)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {vessel && (
          <>
            <SheetHeader>
              <SheetTitle className="num flex items-center gap-2">
                {vessel.vessel_id}
                <VesselStatusBadge status={vessel.status} />
                {vessel.priority === "priority" && <Pill variant="warning">priority</Pill>}
              </SheetTitle>
              <SheetDescription>
                {vessel.type} carrying {vessel.cargo} · synthetic demo vessel
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6 text-sm">
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase">Schedule</h3>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">ETA</dt>
                    <dd className="num mt-0.5">+{vessel.eta_hours}h</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Assigned berth</dt>
                    <dd className="num mt-0.5">{vessel.assigned_berth_id ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Service window</dt>
                    <dd className="num mt-0.5">
                      {entry && !entry.blocked
                        ? `+${entry.service_start}h → +${entry.service_end}h`
                        : "not scheduled"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Handling time</dt>
                    <dd className="num mt-0.5">
                      {entry?.service_hours ?? vessel.unload_duration_hours}h ·{" "}
                      {entry?.cranes_assigned ?? 0} cranes
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Wait</dt>
                    <dd className="num mt-0.5">
                      {entry?.blocked ? "blocked" : `${vessel.wait_time_hours}h`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Berth capability</dt>
                    <dd className="mt-0.5 text-muted-foreground">
                      {berth ? berth.compatible_types.join(", ") : "—"}
                    </dd>
                  </div>
                </dl>
                {entry?.blocked && (
                  <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    {entry.block_reason}
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase">ETA history</h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="num">
                    Filed arrival: +{history?.original_eta ?? vessel.eta_hours}h
                  </li>
                  <li className="num">Current arrival: +{vessel.eta_hours}h</li>
                  <li>{history?.note ?? "No ETA changes recorded."}</li>
                  {vessel.delay_reason && <li className="text-warning">{vessel.delay_reason}</li>}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase">Reassignment</h3>
                {move ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill variant="info">
                        {move.from_berth_id ?? "unassigned"} → {move.to_berth_id}
                      </Pill>
                      <Pill variant="success">saves {move.hours_saved}h</Pill>
                    </div>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {move.reason_lines.map((line) => (
                        <li key={line}>· {line}</li>
                      ))}
                    </ul>
                  </div>
                ) : optimization.unresolved.includes(vessel.vessel_id) ? (
                  <p className="text-xs text-warning">
                    The optimiser could not improve this vessel — no compatible berth frees up sooner.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No reassignment recommended; the original berth is already the best option.
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase">
                  Queue ahead at {entry?.berth_id ?? "berth"}
                </h3>
                {queueAhead.length ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {queueAhead.map((item) => (
                      <li key={item.vessel_id} className="num flex justify-between">
                        <span>{item.vessel_id}</span>
                        <span>
                          +{item.service_start}h → +{item.service_end}h
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nothing ahead of this vessel — it berths on arrival.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
