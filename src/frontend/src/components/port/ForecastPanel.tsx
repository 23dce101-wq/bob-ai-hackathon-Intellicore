import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, HelpCircle } from "lucide-react";
import type { Berth, PredictionPoint, Vessel } from "@/lib/port/types";
import { explainWindow } from "@/lib/port/drivers";
import { buildSchedule } from "@/lib/port/schedule";
import { LevelBadge, Pill } from "./StatusBadge";
import { cn } from "@/lib/utils";

// 72-hour forecast with a "Why?" explanation for any selected window.
export function ForecastPanel({
  prediction,
  berths,
  vessels,
}: {
  prediction: PredictionPoint[];
  berths: Berth[];
  vessels: Vessel[];
}) {
  const risky = prediction.filter((p) => p.level === "high" || p.level === "critical");
  const firstRisk = risky[0];
  const peak = prediction.reduce((a, b) => (b.predicted > a.predicted ? b : a), prediction[0]!);
  const [selectedHour, setSelectedHour] = useState<number>(firstRisk?.hour ?? peak.hour);

  const schedule = useMemo(() => buildSchedule(berths, vessels), [berths, vessels]);
  const selected =
    prediction.find((p) => p.hour === selectedHour) ??
    prediction.find((p) => p.hour === peak.hour) ??
    prediction[0]!;
  const explanation = useMemo(
    () => explainWindow(selected.hour, berths, vessels, selected.level, schedule),
    [selected.hour, selected.level, berths, vessels, schedule],
  );

  return (
    <section className="panel p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            72-hour congestion forecast
          </h2>
          <p className="text-xs text-muted-foreground">
            Weighted queue-pressure model in 6-hour steps — explainable formula, not machine learning
          </p>
        </div>
        <Pill variant={risky.length ? "danger" : "success"}>
          {risky.length ? `${risky.length} high-risk windows` : "No high-risk windows"}
        </Pill>
      </header>

      {firstRisk && (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Congestion reaches {firstRisk.level.toUpperCase()} at {firstRisk.label} —{" "}
          {firstRisk.waiting} vessels queueing for {firstRisk.usable_berths} usable berths. Act
          before this window.
        </p>
      )}

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={prediction} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-popover-foreground)",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              name="Predicted"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={false}
              strokeDasharray="5 4"
            />
            <Line
              type="monotone"
              dataKey="current"
              name="Observed"
              stroke="var(--color-chart-4)"
              strokeWidth={2.5}
              dot={{ r: 2 }}
              connectNulls={false}
            />
            {(peak.level === "high" || peak.level === "critical") && (
              <ReferenceDot
                x={peak.label}
                y={peak.predicted}
                r={6}
                fill="var(--color-destructive)"
                stroke="var(--color-background)"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {prediction.map((point) => (
          <button
            key={point.hour}
            type="button"
            onClick={() => setSelectedHour(point.hour)}
            aria-pressed={point.hour === selected.hour}
            className={cn(
              "num rounded-md border px-2 py-1 text-xs transition-colors",
              point.hour === selected.hour
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary/60",
              (point.level === "high" || point.level === "critical") &&
                point.hour !== selected.hour &&
                "border-destructive/40 text-destructive",
            )}
          >
            {point.label} · {point.predicted}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-md border border-border bg-surface/60 p-3">
        <div className="mb-2 flex items-center gap-2">
          <HelpCircle className="size-4 text-primary" aria-hidden />
          <h3 className="text-xs font-semibold tracking-wide uppercase">
            Why is {selected.label} rated this way?
          </h3>
          <LevelBadge level={selected.level} />
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {explanation.factors.map((factor) => (
            <li key={factor} className="flex gap-2">
              <span className="text-primary" aria-hidden>
                ·
              </span>
              {factor}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
