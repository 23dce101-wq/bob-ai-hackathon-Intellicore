import { useEffect, useMemo, useRef, useState } from "react";
import {
  Anchor,
  Eye,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Berth, OptimizationResult, ScenarioEvent, ServiceEntry, Vessel, VesselType, YardStatus } from "@/lib/port/types";
import { HORIZON, berthUsable, buildSchedule, effectiveCranes } from "@/lib/port/schedule";
import { Pill } from "./StatusBadge";
import { cn } from "@/lib/utils";

/*
 * Interactive top-down terminal model.
 * Every vessel position is DERIVED from the shared 72-hour berth schedule — no
 * random motion, no prerecorded animation. Scrub to any hour and the scene shows
 * exactly what the plan says will be happening then.
 */

const SCENE_W = 1240;
const SCENE_H = 660;
const QUAY_X = 760;
const MOOR_X = QUAY_X - 72;
const BERTH_TOP = 54;
const BERTH_PITCH = 96;
const BAY_H = 80;
const APPROACH_HOURS = 10;
const DEPART_HOURS = 5;

type Phase = "offscope" | "inbound" | "waiting" | "stranded" | "approaching" | "berthed" | "departing" | "completed";

interface Pt {
  x: number;
  y: number;
}

interface Placed {
  vessel: Vessel;
  entry: ServiceEntry;
  phase: Phase;
  point: Pt;
  angle: number;
}

function berthY(index: number): number {
  return BERTH_TOP + index * BERTH_PITCH + BAY_H / 2;
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function alongPath(points: Pt[], t: number): Pt {
  const clamped = Math.max(0, Math.min(1, t));
  const lengths = points.slice(1).map((point, i) => {
    const prev = points[i]!;
    return Math.hypot(point.x - prev.x, point.y - prev.y);
  });
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let travelled = clamped * total;
  for (let i = 0; i < lengths.length; i++) {
    if (travelled <= lengths[i]!) {
      return lerp(points[i]!, points[i + 1]!, lengths[i]! ? travelled / lengths[i]! : 0);
    }
    travelled -= lengths[i]!;
  }
  return points[points.length - 1]!;
}

function inboundPathToBerth(y: number): Pt[] {
  return [
    { x: -90, y: 300 },
    { x: 160, y: 300 },
    { x: 430, y: 300 },
    { x: 580, y },
    { x: MOOR_X, y },
  ];
}

function inboundPathToWaiting(slot: Pt): Pt[] {
  return [
    { x: -90, y: 300 },
    { x: 160, y: 300 },
    { x: slot.x, y: slot.y },
  ];
}

function departPath(y: number): Pt[] {
  return [
    { x: MOOR_X, y },
    { x: 600, y },
    { x: 450, y: 390 },
    { x: 160, y: 390 },
    { x: -90, y: 390 },
  ];
}

function anchorSlot(index: number): Pt {
  const cols = 5;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { x: 190 + col * 62, y: 80 + row * 65 };
}

function heading(points: Pt[], t: number): number {
  const a = alongPath(points, Math.max(0, t - 0.02));
  const b = alongPath(points, Math.min(1, t + 0.02));
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function place(entry: ServiceEntry, vessel: Vessel, hour: number, index: number, y: number): Placed {
  const arrival = entry.arrival;
  const start = entry.service_start;
  const end = entry.service_end;
  const slot = anchorSlot(index);
  const outPath = departPath(y);

  if (hour < arrival - APPROACH_HOURS) {
    return { vessel, entry, phase: "offscope", point: { x: -200, y: 300 }, angle: 0 };
  }

  // Determine if vessel must wait at anchorage before berth service
  const hasWait = entry.blocked || entry.wait_hours > 0 || (start !== null && start > arrival);

  if (hour < arrival) {
    const raw = (hour - (arrival - APPROACH_HOURS)) / APPROACH_HOURS;
    const t = Math.max(0, Math.min(1, raw));

    if (hasWait) {
      // Move directly from sea channel to the Waiting Area (Anchorage slot)
      const inWaiting = inboundPathToWaiting(slot);
      return { vessel, entry, phase: "inbound", point: alongPath(inWaiting, t), angle: heading(inWaiting, t) };
    } else {
      // Move directly from sea channel to the Assigned Berth
      const inBerth = inboundPathToBerth(y);
      return { vessel, entry, phase: "inbound", point: alongPath(inBerth, t), angle: heading(inBerth, t) };
    }
  }

  // Stranded: blocked berth or no valid service window
  if (entry.blocked || start === null || end === null) {
    return { vessel, entry, phase: "stranded", point: slot, angle: -20 };
  }

  // Waiting at anchorage until service start window begins
  if (hour < start - 1.5) {
    return { vessel, entry, phase: "waiting", point: slot, angle: -8 };
  }

  // Approaching berth from Waiting Area slot (1.5h before service start)
  if (hour < start) {
    const t = Math.max(0, Math.min(1, 1 - (start - hour) / 1.5));
    const target = { x: MOOR_X, y };
    return {
      vessel,
      entry,
      phase: "approaching",
      point: lerp(slot, target, t),
      angle: (Math.atan2(target.y - slot.y, target.x - slot.x) * 180) / Math.PI,
    };
  }

  // Berthed & servicing
  if (hour < end) {
    return { vessel, entry, phase: "berthed", point: { x: MOOR_X, y }, angle: 0 };
  }

  // Departing from berth
  if (hour < end + DEPART_HOURS) {
    const t = (hour - end) / DEPART_HOURS;
    return {
      vessel,
      entry,
      phase: "departing",
      point: alongPath(outPath, t),
      angle: heading(outPath, t),
    };
  }

  return { vessel, entry, phase: "completed", point: { x: -200, y: 390 }, angle: 0 };
}

const PHASE_LABEL: Record<Phase, string> = {
  offscope: "Not yet in range",
  inbound: "Inbound in channel",
  waiting: "Waiting at anchorage",
  stranded: "Stranded — no berth available",
  approaching: "Approaching berth",
  berthed: "Alongside, unloading",
  departing: "Departing",
  completed: "Sailed",
};

const PHASE_FILL: Record<Phase, string> = {
  offscope: "var(--color-muted)",
  inbound: "var(--color-info)",
  waiting: "var(--color-warning)",
  stranded: "var(--color-destructive)",
  approaching: "var(--color-primary)",
  berthed: "var(--color-success)",
  departing: "var(--color-primary)",
  completed: "var(--color-muted)",
};

function VesselGlyph({
  type,
  length,
  fill,
  highlighted,
}: {
  type: VesselType;
  length: number;
  fill: string;
  highlighted: boolean;
}) {
  const h = type === "Bulk" ? 26 : type === "Tanker" ? 24 : 22;
  const half = length / 2;

  return (
    <g>
      {/* hull: blunt stern, pointed bow to the right */}
      <path
        d={`M ${-half} ${-h / 2} L ${half - 16} ${-h / 2} L ${half} 0 L ${half - 16} ${h / 2} L ${-half} ${h / 2} Z`}
        fill={fill}
        fillOpacity={0.85}
        stroke={highlighted ? "var(--color-primary)" : "var(--color-background)"}
        strokeWidth={highlighted ? 2.5 : 1.2}
      />
      {type === "Container" &&
        Array.from({ length: Math.max(3, Math.round(length / 16)) }).map((_, i) => (
          <rect
            key={i}
            x={-half + 6 + i * 15}
            y={-h / 2 + 3}
            width={11}
            height={h - 6}
            rx={1}
            fill="var(--color-background)"
            fillOpacity={0.35}
          />
        ))}
      {type === "Bulk" &&
        Array.from({ length: 4 }).map((_, i) => (
          <rect
            key={i}
            x={-half + 10 + i * (length / 5)}
            y={-h / 2 + 5}
            width={length / 8}
            height={h - 10}
            rx={2}
            fill="var(--color-background)"
            fillOpacity={0.3}
          />
        ))}
      {type === "Tanker" && (
        <>
          <line
            x1={-half + 8}
            y1={0}
            x2={half - 18}
            y2={0}
            stroke="var(--color-background)"
            strokeOpacity={0.4}
            strokeWidth={3}
          />
          <circle cx={-half + 18} cy={0} r={5} fill="var(--color-background)" fillOpacity={0.35} />
        </>
      )}
      {/* superstructure at the stern */}
      <rect
        x={-half + 2}
        y={-h / 2 - 5}
        width={12}
        height={h + 10}
        rx={2}
        fill="var(--color-foreground)"
        fillOpacity={0.5}
      />
    </g>
  );
}

export function PortSimulation({ berths, vessels, yard, events, optimization }: { berths: Berth[]; vessels: Vessel[]; yard?: YardStatus; events?: ScenarioEvent[]; optimization?: OptimizationResult }) {
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [selected, setSelected] = useState<{ kind: "vessel" | "berth"; id: string } | null>(null);
  const frame = useRef<number | null>(null);

  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let cancelled = false;
    let frameCount = 0;
    const tick = (now: number) => {
      if (cancelled) return;
      frameCount++;
      // Update hour every 2nd frame to reduce recomputation with many vessels
      if (frameCount % 2 === 0) {
        const delta = ((now - last) / 1000) * speed * 1.6;
        setHour((prev) => {
          const next = prev + delta;
          if (next >= HORIZON) {
            setPlaying(false);
            return HORIZON;
          }
          return next;
        });
      }
      last = now;
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [playing, speed]);

  // Pause when browser tab is hidden (user navigates away)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && playing) setPlaying(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [playing]);

  const placed = useMemo(() => {
    const byIndex = new Map<string, number>();
    berths.forEach((berth, index) => byIndex.set(berth.berth_id, index));

    const waitingSlotMap = new Map<string, number>();
    let nextSlot = 0;
    schedule.entries.forEach((entry) => {
      const start = entry.service_start;
      const hasWait = entry.blocked || entry.wait_hours > 0 || (start !== null && start > entry.arrival);
      if (hasWait) {
        waitingSlotMap.set(entry.vessel_id, nextSlot++);
      }
    });

    return schedule.entries
      .map((entry) => {
        const vessel = vessels.find((item) => item.vessel_id === entry.vessel_id);
        if (!vessel) return null;
        const y = berthY(byIndex.get(entry.berth_id ?? "") ?? 2);
        const slotIdx = waitingSlotMap.get(entry.vessel_id) ?? 0;
        return place(entry, vessel, hour, slotIdx, y);
      })
      .filter((item): item is Placed => item !== null && item.phase !== "offscope" && item.phase !== "completed");
  }, [schedule, vessels, berths, hour]);

  const counts = {
    inbound: placed.filter((item) => item.phase === "inbound" || item.phase === "approaching").length,
    waiting: placed.filter((item) => item.phase === "waiting").length,
    berthed: placed.filter((item) => item.phase === "berthed").length,
    departing: placed.filter((item) => item.phase === "departing").length,
    stranded: placed.filter((item) => item.phase === "stranded").length,
  };

  // Dynamic metrics derived from actual schedule entries of berthed vessels.
  // TEU per vessel estimated from cargo type: Container ≈ 800 TEU, Bulk ≈ 400, Tanker ≈ 200.
  const berthedEntries = placed
    .filter((item) => item.phase === "berthed")
    .map((item) => item.entry);

  const activeCranes = berthedEntries.reduce((sum, e) => sum + e.cranes_assigned, 0);

  // TEU unloaded for each berthed vessel = (progress through service window) × vessel TEU capacity.
  const teuUnloaded = placed
    .filter((item) => item.phase === "berthed")
    .reduce((sum, item) => {
      const start = item.entry.service_start ?? hour;
      const end = item.entry.service_end ?? hour;
      const duration = Math.max(1, end - start);
      const progress = Math.min(1, Math.max(0, (hour - start) / duration));
      const teuCapacity = item.vessel.type === "Container" ? 800 : item.vessel.type === "Bulk" ? 400 : 200;
      return sum + Math.round(progress * teuCapacity);
    }, 0);

  // Throughput rate = sum of (TEU capacity / service hours) for all berthed vessels.
  const throughputRate = placed
    .filter((item) => item.phase === "berthed")
    .reduce((sum, item) => {
      const serviceHrs = Math.max(1, item.entry.service_hours);
      const teuCapacity = item.vessel.type === "Container" ? 800 : item.vessel.type === "Bulk" ? 400 : 200;
      return sum + teuCapacity / serviceHrs;
    }, 0);

  const day = Math.floor(hour / 24) + 1;
  const clock = `Day ${day} · ${String(Math.floor(hour % 24)).padStart(2, "0")}:${String(
    Math.round((hour % 1) * 60),
  ).padStart(2, "0")}`;

  // Dynamic yard utilization: baseline TEU + TEU unloaded by berthed vessels at each hour
  const dynamicYardUtil = useMemo(() => {
    if (!yard?.blocks) return new Map<string, number>();
    const result = new Map<string, number>();

    // Start from baseline yard data
    for (const block of yard.blocks) {
      let currentTeu = block.used_teu;

      // Add TEU from vessels currently berthed at blocks serving this berth
      for (const item of placed) {
        if (item.phase !== "berthed") continue;
        if (item.vessel.type !== "Container") continue;
        const servesBerth = block.serving_berths.includes(item.entry.berth_id ?? "");
        if (!servesBerth) continue;

        const start = item.entry.service_start ?? hour;
        const end = item.entry.service_end ?? hour;
        const duration = Math.max(1, end - start);
        const progress = Math.min(1, Math.max(0, (hour - start) / duration));
        const teuCapacity = 800;
        currentTeu += Math.round(progress * teuCapacity);
      }

      const util = block.total_teu > 0 ? Math.min(100, Math.round((currentTeu / block.total_teu) * 100)) : 0;
      result.set(block.block_id, util);
    }
    return result;
  }, [yard, placed, hour]);

  const selectedVessel =
    selected?.kind === "vessel" ? placed.find((item) => item.vessel.vessel_id === selected.id) : undefined;
  const selectedBerth =
    selected?.kind === "berth" ? berths.find((item) => item.berth_id === selected.id) : undefined;

  return (
    <section className="panel p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Live terminal simulation
          </h2>
          <p className="text-xs text-muted-foreground">
            Positions derived from the 72-hour berth plan — scrub, click a ship or a berth to inspect
            it
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill variant="info">{clock}</Pill>
          <Pill variant="muted">+{hour.toFixed(1)}h of {HORIZON}h</Pill>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setPlaying((prev) => !prev)}>
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setPlaying(false);
            setHour(0);
          }}
        >
          <RotateCcw className="size-4" aria-hidden /> Restart
        </Button>
        <Button size="sm" variant="outline" onClick={() => setHour((prev) => Math.max(0, prev - 1))}>
          <SkipBack className="size-4" aria-hidden /> −1h
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setHour((prev) => Math.min(HORIZON, prev + 1))}
        >
          <SkipForward className="size-4" aria-hidden /> +1h
        </Button>
        <div className="flex items-center gap-1">
          {[1, 2, 4, 8].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSpeed(value)}
              aria-pressed={speed === value}
              className={cn(
                "num rounded-md border px-2 py-1 text-xs transition-colors",
                speed === value
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:border-primary/60",
              )}
            >
              {value}×
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[0, 12, 24, 48, 72].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setHour(value)}
              className="num rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              +{value}h
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowRoutes((prev) => !prev)}
            aria-pressed={showRoutes}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              showRoutes ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            <MapIcon className="size-3.5" aria-hidden /> Routes
          </button>
          <button
            type="button"
            onClick={() => setShowLabels((prev) => !prev)}
            aria-pressed={showLabels}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              showLabels ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            <Tag className="size-3.5" aria-hidden /> Labels
          </button>
          <button
            type="button"
            onClick={() => setShowOverlays((prev) => !prev)}
            aria-pressed={showOverlays}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              showOverlays ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            <Eye className="size-3.5" aria-hidden /> Overlays
          </button>
        </div>
      </div>

      <div className="mb-3">
        <Slider
          value={[hour]}
          min={0}
          max={HORIZON}
          step={0.5}
          onValueChange={([value]) => {
            setPlaying(false);
            setHour(value ?? 0);
          }}
          aria-label="Simulation hour"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_280px] xl:min-h-[520px]">
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <svg
            viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
            className="h-auto w-full min-w-[900px] xl:h-full"
            role="img"
            aria-label="Top-down view of the container terminal at the selected hour"
          >
            <defs>
              <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--color-background)" />
                <stop offset="100%" stopColor="var(--color-secondary)" />
              </linearGradient>
              <linearGradient id="land" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-surface)" />
                <stop offset="100%" stopColor="var(--color-card)" />
              </linearGradient>
              <pattern id="hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-destructive)" strokeWidth="3" strokeOpacity="0.35" />
              </pattern>
            </defs>

            {/* water */}
            <rect x={0} y={0} width={QUAY_X} height={SCENE_H} fill="url(#sea)" />
            {Array.from({ length: 12 }).map((_, i) => (
              <path
                key={i}
                d={`M 0 ${30 + i * 56} q 60 10 120 0 t 120 0 t 120 0 t 120 0 t 120 0 t 120 0`}
                fill="none"
                stroke="var(--color-primary)"
                strokeOpacity={0.07}
                strokeWidth={2}
              >
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={`0,0;${i % 2 === 0 ? '8,-2' : '-8,2'};0,0`}
                  dur={`${4 + i * 0.3}s`}
                  repeatCount="indefinite"
                />
              </path>
            ))}

            {/* navigation channel */}
            <polygon
              points={`-10,246 460,246 640,${SCENE_H - 20} -10,${SCENE_H - 20}`}
              fill="var(--color-primary)"
              fillOpacity={0.04}
            />
            {/* Animated channel traffic lights */}
            {[80, 200, 340, 480].map((x, i) => (
              <g key={`light-${x}`}>
                <circle cx={x} cy={248} r={3} fill="var(--color-success)">
                  <animate
                    attributeName="fill-opacity"
                    values="0.8;0.2;0.8"
                    dur={`${2 + i * 0.5}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx={x} cy={SCENE_H - 40} r={3} fill="var(--color-destructive)">
                  <animate
                    attributeName="fill-opacity"
                    values="0.2;0.8;0.2"
                    dur={`${2 + i * 0.5}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            ))}
            {showRoutes && (
              <>
                <line
                  x1={0}
                  y1={300}
                  x2={430}
                  y2={300}
                  stroke="var(--color-info)"
                  strokeOpacity={0.5}
                  strokeDasharray="14 10"
                  strokeWidth={2}
                />
                <line
                  x1={0}
                  y1={390}
                  x2={430}
                  y2={390}
                  stroke="var(--color-primary)"
                  strokeOpacity={0.35}
                  strokeDasharray="6 10"
                  strokeWidth={2}
                />
                {berths.map((berth, index) => (
                  <path
                    key={berth.berth_id}
                    d={`M 430 300 Q 560 ${berthY(index)} ${MOOR_X - 30} ${berthY(index)}`}
                    fill="none"
                    stroke="var(--color-info)"
                    strokeOpacity={berthUsable(berth) ? 0.22 : 0.08}
                    strokeDasharray="4 8"
                    strokeWidth={1.5}
                  />
                ))}
                {[120, 260, 400].map((x) => (
                  <g key={x}>
                    <circle cx={x} cy={252} r={4} fill="var(--color-success)" fillOpacity={0.7} />
                    <circle cx={x} cy={434} r={4} fill="var(--color-destructive)" fillOpacity={0.6} />
                  </g>
                ))}
              </>
            )}

            {/* anchorage */}
            <rect
              x={170}
              y={56}
              width={350}
              height={560}
              rx={18}
              fill="var(--color-warning)"
              fillOpacity={0.04}
              stroke="var(--color-warning)"
              strokeOpacity={0.28}
              strokeDasharray="10 8"
            />
            {showOverlays && (
              <text x={186} y={80} fill="var(--color-warning)" fontSize={12} opacity={0.8}>
                ANCHORAGE — WAITING AREA
              </text>
            )}
            {showOverlays && (
              <>
                <text x={20} y={292} fill="var(--color-info)" fontSize={11} opacity={0.75}>
                  INBOUND CHANNEL
                </text>
                <text x={20} y={410} fill="var(--color-primary)" fontSize={11} opacity={0.6}>
                  OUTBOUND CHANNEL
                </text>
              </>
            )}

            {/* land / terminal */}
            <rect x={QUAY_X} y={0} width={SCENE_W - QUAY_X} height={SCENE_H} fill="url(#land)" />
            <rect x={QUAY_X} y={0} width={10} height={SCENE_H} fill="var(--color-border)" />
            {/* apron safety line */}
            <line
              x1={QUAY_X + 16}
              y1={0}
              x2={QUAY_X + 16}
              y2={SCENE_H}
              stroke="var(--color-warning)"
              strokeOpacity={0.45}
              strokeDasharray="12 10"
              strokeWidth={2}
            />
            {/* crane rails */}
            {[QUAY_X + 34, QUAY_X + 62].map((x) => (
              <line
                key={x}
                x1={x}
                y1={20}
                x2={x}
                y2={SCENE_H - 20}
                stroke="var(--color-border)"
                strokeWidth={2}
              />
            ))}

            {/* container yard */}
            <rect
              x={QUAY_X + 92}
              y={30}
              width={SCENE_W - QUAY_X - 120}
              height={SCENE_H - 60}
              rx={10}
              fill="var(--color-background)"
              fillOpacity={0.5}
              stroke="var(--color-border)"
            />
            {showOverlays && (
              <text x={QUAY_X + 104} y={22} fill="var(--color-muted-foreground)" fontSize={11}>
                CONTAINER YARD
              </text>
            )}
            {berths.map((berth, index) => {
              // Use dynamic yard data that changes as simulation progresses
              const matchingBlocks = yard?.blocks.filter((b) => b.serving_berths.includes(berth.berth_id)) ?? [];
              const yardBlock = matchingBlocks.length > 0
                ? matchingBlocks.reduce((a, b) => (a.used_teu / a.total_teu) > (b.used_teu / b.total_teu) ? a : b)
                : null;
              const dynamicUtil = yardBlock
                ? (dynamicYardUtil.get(yardBlock.block_id) ?? Math.round((yardBlock.used_teu / yardBlock.total_teu) * 100))
                : berth.yard_saturation_pct;
              const rows = Math.max(1, Math.round((dynamicUtil / 100) * 5));
              const isHighSat = dynamicUtil >= 85;
              const isCritical = dynamicUtil >= 95;
              return (
                <g key={`yard-${berth.berth_id}`}>
                  {Array.from({ length: 5 }).map((_, col) =>
                    Array.from({ length: rows }).map((__, row) => (
                      <rect
                        key={`${col}-${row}`}
                        x={QUAY_X + 108 + col * 52}
                        y={berthY(index) - 30 + row * 12}
                        width={44}
                        height={9}
                        rx={1.5}
                        fill={
                          isCritical
                            ? "var(--color-destructive)"
                            : isHighSat
                              ? "var(--color-warning)"
                              : ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-4)", "var(--color-chart-5)"][
                                  (col + row) % 4
                                ]
                        }
                        fillOpacity={isCritical ? 0.6 : isHighSat ? 0.5 : 0.35}
                      />
                    )),
                  )}
                  {showOverlays && (
                    <text
                      x={SCENE_W - 46}
                      y={berthY(index) + 4}
                      fill={isCritical ? "var(--color-destructive)" : isHighSat ? "var(--color-warning)" : "var(--color-muted-foreground)"}
                      fontSize={isCritical ? 13 : 11}
                      fontWeight={isCritical || isHighSat ? 700 : 400}
                      textAnchor="end"
                    >
                      {dynamicUtil}%
                      {isCritical ? " !" : isHighSat ? " !" : ""}
                    </text>
                  )}
                </g>
              );
            })}

            {/* berth bays + cranes */}
            {berths.map((berth, index) => {
              const y = berthY(index);
              const usable = berthUsable(berth);
              const cranes = effectiveCranes(berth);
              const working = placed.find(
                (item) => item.phase === "berthed" && item.entry.berth_id === berth.berth_id,
              );
              const isSelected = selected?.kind === "berth" && selected.id === berth.berth_id;
              const hasVessel = Boolean(working);

              return (
                <g key={berth.berth_id}>
                  {/* Berth bay with activity indicator */}
                  <rect
                    x={QUAY_X - 4}
                    y={y - BAY_H / 2}
                    width={26}
                    height={BAY_H}
                    rx={3}
                    fill={usable ? "var(--color-success)" : "var(--color-destructive)"}
                    fillOpacity={usable ? (hasVessel ? 0.35 : 0.16) : 0.28}
                    stroke={isSelected ? "var(--color-primary)" : hasVessel ? "var(--color-success)" : "transparent"}
                    strokeWidth={hasVessel ? 2 : isSelected ? 2 : 0}
                  />
                  {/* Pulsing activity ring when vessel is berthed */}
                  {hasVessel && (
                    <circle
                      cx={QUAY_X + 9}
                      cy={y}
                      r={BAY_H / 2 + 8}
                      fill="none"
                      stroke="var(--color-success)"
                      strokeWidth={1.5}
                      strokeOpacity={0.4}
                    >
                      <animate
                        attributeName="r"
                        values={`${BAY_H / 2 + 4};${BAY_H / 2 + 14};${BAY_H / 2 + 4}`}
                        dur="3s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="stroke-opacity"
                        values="0.5;0.15;0.5"
                        dur="3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  {!usable && (
                    <rect
                      x={QUAY_X - 4}
                      y={y - BAY_H / 2}
                      width={26}
                      height={BAY_H}
                      fill="url(#hatch)"
                    />
                  )}
                  {/* bollards */}
                  {[-28, 0, 28].map((offset) => (
                    <circle
                      key={offset}
                      cx={QUAY_X + 4}
                      cy={y + offset}
                      r={3}
                      fill="var(--color-muted-foreground)"
                      fillOpacity={0.7}
                    />
                  ))}

                  {/* gantry cranes: one portal per crane, greyed when out of service */}
                  {Array.from({ length: berth.crane_count }).map((_, i) => {
                    const out = i >= cranes;
                    const cy = y - BAY_H / 2 + 12 + i * ((BAY_H - 20) / Math.max(1, berth.crane_count - 1 || 1));
                    const active = Boolean(working) && !out;
                    const colour = out
                      ? "var(--color-destructive)"
                      : active
                        ? "var(--color-primary)"
                        : "var(--color-muted-foreground)";
                    return (
                      <g key={i} opacity={out ? 0.5 : 1}>
                        <line
                          x1={QUAY_X + 62}
                          y1={cy}
                          x2={MOOR_X - 20}
                          y2={cy}
                          stroke={colour}
                          strokeWidth={2.5}
                          strokeDasharray={out ? "4 4" : undefined}
                        />
                        <rect x={QUAY_X + 30} y={cy - 9} width={8} height={18} fill={colour} rx={1.5} />
                        <rect x={QUAY_X + 58} y={cy - 9} width={8} height={18} fill={colour} rx={1.5} />
                        {active && (
                          <>
                            {/* Moving cargo container along crane arm */}
                            <circle cx={MOOR_X + 6} cy={cy} r={4} fill="var(--color-primary)">
                              <animate
                                attributeName="cx"
                                values={`${MOOR_X - 14};${QUAY_X + 40};${MOOR_X - 14}`}
                                dur="2.4s"
                                repeatCount="indefinite"
                              />
                            </circle>
                            {/* Crane base glow */}
                            <rect
                              x={QUAY_X + 28}
                              y={cy - 11}
                              width={12}
                              height={22}
                              rx={2}
                              fill="var(--color-primary)"
                              fillOpacity={0.15}
                            >
                              <animate
                                attributeName="fill-opacity"
                                values="0.2;0.05;0.2"
                                dur="2s"
                                repeatCount="indefinite"
                              />
                            </rect>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* clickable berth label */}
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect berth ${berth.berth_id}`}
                    onClick={() => setSelected({ kind: "berth", id: berth.berth_id })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ")
                        setSelected({ kind: "berth", id: berth.berth_id });
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x={QUAY_X + 74}
                      y={y - 34}
                      width={14}
                      height={68}
                      rx={3}
                      fill="var(--color-surface)"
                      stroke="var(--color-border)"
                    />
                    {showLabels && (
                      <text
                        x={QUAY_X + 84}
                        y={y}
                        fill={usable ? "var(--color-foreground)" : "var(--color-destructive)"}
                        fontSize={12}
                        textAnchor="middle"
                        transform={`rotate(-90 ${QUAY_X + 84} ${y})`}
                      >
                        {berth.berth_id} · {cranes}/{berth.crane_count}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}

            {/* vessels */}
            {placed.map((item) => {
              const isSelected = selected?.kind === "vessel" && selected.id === item.vessel.vessel_id;
              const length = 70 + Math.min(58, item.vessel.unload_duration_hours * 3);
              const isPriority = item.vessel.priority === "priority";
              const isBerthed = item.phase === "berthed";
              const isStranded = item.phase === "stranded";
              return (
                <g
                  key={item.vessel.vessel_id}
                  transform={`translate(${item.point.x} ${item.point.y}) rotate(${item.angle})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect vessel ${item.vessel.vessel_id}`}
                  onClick={() => setSelected({ kind: "vessel", id: item.vessel.vessel_id })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      setSelected({ kind: "vessel", id: item.vessel.vessel_id });
                  }}
                  className="cursor-pointer"
                >
                  {/* Priority glow */}
                  {isPriority && isBerthed && (
                    <circle r={length / 2 + 8} fill="var(--color-warning)" fillOpacity={0.12}>
                      <animate
                        attributeName="fill-opacity"
                        values="0.15;0.05;0.15"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  {/* Stranded pulse ring */}
                  {isStranded && (
                    <circle r={length / 3} fill="var(--color-destructive)" fillOpacity={0.1}>
                      <animate
                        attributeName="r"
                        values={`${length / 3};${length / 2 + 6};${length / 3}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="fill-opacity"
                        values="0.12;0.02;0.12"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <VesselGlyph
                    type={item.vessel.type}
                    length={length}
                    fill={PHASE_FILL[item.phase]}
                    highlighted={isSelected}
                  />
                  {item.phase === "stranded" && (
                    <circle r={5} cx={0} cy={-24} fill="var(--color-destructive)">
                      <animate attributeName="r" values="4;7;4" dur="1.4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {showLabels && (
                    <text
                      x={0}
                      y={-20}
                      fill="var(--color-foreground)"
                      fontSize={11}
                      textAnchor="middle"
                      transform={`rotate(${-item.angle})`}
                    >
                      {item.vessel.vessel_id}
                      {isPriority ? " ★" : ""}
                    </text>
                  )}
                  {showOverlays && item.entry.wait_hours > 0 && item.phase !== "berthed" && (
                    <text
                      x={0}
                      y={26}
                      fill="var(--color-warning)"
                      fontSize={10}
                      textAnchor="middle"
                      transform={`rotate(${-item.angle})`}
                    >
                      wait {item.entry.blocked ? "blocked" : `${item.entry.wait_hours}h`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* compass + scale */}
            <g opacity={0.6}>
              <circle cx={92} cy={80} r={22} fill="none" stroke="var(--color-border)" />
              <path d="M 92 62 L 97 82 L 92 78 L 87 82 Z" fill="var(--color-primary)" />
              <text x={92} y={58} fill="var(--color-muted-foreground)" fontSize={10} textAnchor="middle">
                N
              </text>
              <line x1={40} y1={SCENE_H - 30} x2={160} y2={SCENE_H - 30} stroke="var(--color-border)" strokeWidth={2} />
              <text x={40} y={SCENE_H - 38} fill="var(--color-muted-foreground)" fontSize={10}>
                500 m (schematic)
              </text>
            </g>
          </svg>
        </div>

        <aside className="space-y-2 overflow-y-auto" aria-label="Simulation inspector">
          {/* Fleet Activity Summary */}
          <div className="rounded-md border border-border bg-card/50 p-2.5">
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Fleet Activity</div>
            <div className="flex items-center gap-1">
              {([
                ["inbound", counts.inbound, "info"],
                ["waiting", counts.waiting, "warning"],
                ["berthed", counts.berthed, "success"],
                ["departing", counts.departing, "muted"],
                ["stranded", counts.stranded, "danger"],
              ] as const).map(([phase, count, variant]) => (
                <div
                  key={phase}
                  className={cn(
                    "flex flex-1 flex-col items-center rounded px-1 py-1 text-[11px] transition-all duration-300",
                    count > 0 && variant === "success" && "bg-success/10 ring-1 ring-success/30",
                    count > 0 && variant === "danger" && "bg-destructive/10 ring-1 ring-destructive/30",
                    count > 0 && variant === "warning" && "bg-warning/10 ring-1 ring-warning/30",
                  )}
                >
                  <span className={cn(
                    "text-base font-bold tabular-nums transition-transform duration-200",
                    count > 0 && "scale-110",
                  )}>
                    {count}
                  </span>
                  <span className="text-[9px] text-muted-foreground capitalize leading-tight">{phase}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Terminal Status */}
          <div className="rounded-md border border-border p-2.5">
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Live Terminal Status</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">TEUs discharged</span>
                <span className="num font-medium">{teuUnloaded.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active cranes</span>
                <span className="num font-medium">{activeCranes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Throughput rate</span>
                <span className="num font-medium">
                  {counts.berthed > 0 ? `${Math.round(throughputRate)} TEU/h` : "0 TEU/h"}
                </span>
              </div>
            </div>
          </div>

          {/* Selection Inspector */}
          <div className="rounded-md border border-border p-2.5">
            {selectedVessel ? (
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <p className="num text-xs font-semibold">{selectedVessel.vessel.vessel_id}</p>
                  <Pill
                    variant={
                      selectedVessel.phase === "stranded"
                        ? "danger"
                        : selectedVessel.phase === "berthed"
                          ? "success"
                          : "info"
                    }
                  >
                    {PHASE_LABEL[selectedVessel.phase]}
                  </Pill>
                </div>
                <p className="text-muted-foreground">
                  {selectedVessel.vessel.type} · {selectedVessel.vessel.cargo}
                </p>
                <p className="num text-muted-foreground">
                  ETA +{selectedVessel.entry.arrival}h · berth {selectedVessel.entry.berth_id ?? "—"}
                </p>
                <p className="num text-muted-foreground">
                  {selectedVessel.entry.blocked
                    ? selectedVessel.entry.block_reason
                    : `Service +${selectedVessel.entry.service_start}h → +${selectedVessel.entry.service_end}h (${selectedVessel.entry.service_hours}h, ${selectedVessel.entry.cranes_assigned} cranes)`}
                </p>
                <p className="num text-muted-foreground">
                  Wait {selectedVessel.entry.blocked ? "unresolved" : `${selectedVessel.entry.wait_hours}h`}
                </p>
                {selectedVessel.vessel.delay_reason && (
                  <p className="text-warning">{selectedVessel.vessel.delay_reason}</p>
                )}
              </div>
            ) : selectedBerth ? (
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <p className="num text-xs font-semibold">Berth {selectedBerth.berth_id}</p>
                  <Pill variant={berthUsable(selectedBerth) ? "success" : "danger"}>
                    {selectedBerth.status === "closed" ? "Closed" : berthUsable(selectedBerth) ? "Operational" : "No cranes"}
                  </Pill>
                </div>
                <p className="text-muted-foreground">
                  {effectiveCranes(selectedBerth)}/{selectedBerth.crane_count} cranes ·{" "}
                  {selectedBerth.length_m} m
                </p>
                <p className="text-muted-foreground">
                  Handles {selectedBerth.compatible_types.join(", ")}
                </p>
                <p className="num text-muted-foreground">
                  Utilisation{" "}
                  {schedule.utilization.find((item) => item.berth_id === selectedBerth.berth_id)
                    ?.utilization_pct ?? 0}
                  % · queue{" "}
                  {schedule.entries.filter((item) => item.berth_id === selectedBerth.berth_id).length}
                </p>
                {selectedBerth.closure_reason && (
                  <p className="text-destructive">Closed: {selectedBerth.closure_reason}</p>
                )}
                <ul className="mt-1 space-y-0.5">
                  {schedule.entries
                    .filter((item) => item.berth_id === selectedBerth.berth_id)
                    .slice(0, 6)
                    .map((item) => (
                      <li key={item.vessel_id} className="num flex justify-between text-muted-foreground">
                        <span>{item.vessel_id}</span>
                        <span>
                          {item.blocked ? "blocked" : `+${item.service_start}h → +${item.service_end}h`}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Anchor className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
                Click any vessel or berth in the terminal to inspect its assignment, cargo, service
                window and wait time.
              </p>
            )}
          </div>

          {/* Phase Legend */}
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {(
              [
                ["inbound", "Inbound"],
                ["waiting", "Waiting"],
                ["berthed", "Alongside"],
                ["departing", "Departing"],
                ["stranded", "Stranded"],
              ] as [Phase, string][]
            ).map(([phase, label]) => (
              <li key={phase} className="flex items-center gap-1">
                <span
                  className="size-2 rounded-sm"
                  style={{ background: PHASE_FILL[phase] }}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>

          {/* Live Activity Log */}
          <div className="rounded-md border border-border p-2.5">
            <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Live Activity</div>
            <div className="max-h-[160px] space-y-0.5 overflow-y-auto">
              {placed
                .filter((item) => item.phase !== "offscope" && item.phase !== "completed")
                .sort((a, b) => {
                  const order: Record<Phase, number> = { stranded: 0, waiting: 1, approaching: 2, inbound: 3, berthed: 4, departing: 5, offscope: 6, completed: 7 };
                  return order[a.phase] - order[b.phase];
                })
                .slice(0, 10)
                .map((item) => {
                  const progress = item.phase === "berthed"
                    ? (() => {
                        const start = item.entry.service_start ?? 0;
                        const end = item.entry.service_end ?? start + 1;
                        return Math.round(Math.max(0, Math.min(1, (hour - start) / (end - start))) * 100);
                      })()
                    : null;
                  return (
                    <div
                      key={item.vessel.vessel_id}
                      className={cn(
                        "flex items-center justify-between rounded px-2 py-0.5 text-[11px] transition-colors",
                        item.phase === "stranded" && "bg-destructive/5",
                        item.phase === "berthed" && "bg-success/5",
                        item.phase === "waiting" && "bg-warning/5",
                      )}
                    >
                      <span className="num font-medium">{item.vessel.vessel_id}</span>
                      <span className="text-muted-foreground">{item.vessel.type}</span>
                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[10px] font-medium",
                          item.phase === "stranded" && "bg-destructive/15 text-destructive",
                          item.phase === "berthed" && "bg-success/15 text-success",
                          item.phase === "waiting" && "bg-warning/15 text-warning",
                          item.phase === "inbound" && "bg-info/15 text-info",
                          item.phase === "approaching" && "bg-primary/15 text-primary",
                          item.phase === "departing" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {item.phase === "berthed" && progress !== null ? `${progress}%` : item.phase}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
