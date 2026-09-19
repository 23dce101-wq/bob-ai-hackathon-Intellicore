// 72-hour forward prediction.
// Heuristic, NOT machine learning: for each 6-hour window the shared schedule is
// inspected for arrivals, queueing vessels and available capacity, combined with
// a fixed weighted formula, then lightly smoothed so it reads as a trend.

import { levelFromScore } from "./congestion";
import { berthUsable, berthedAt, buildSchedule, waitingAt } from "./schedule";
import type { Berth, PredictionPoint, Vessel } from "./types";

const STEP = 6;
const HORIZON = 72;

export function predictCongestion(berths: Berth[], vessels: Vessel[]): PredictionPoint[] {
  const schedule = buildSchedule(berths, vessels);
  const usable = berths.filter(berthUsable);
  const closedCount = berths.length - usable.length;
  const points: PredictionPoint[] = [];
  let prev = 0;

  for (let hour = 0; hour <= HORIZON; hour += STEP) {
    const arrivals = vessels.filter(
      (vessel) => vessel.eta_hours >= hour && vessel.eta_hours < hour + STEP,
    ).length;
    const waiting = waitingAt(schedule, hour).length;
    const berthed = berthedAt(schedule, hour).length;

    // Weighted formula: queue pressure per usable berth + arrival burst + lost capacity.
    const raw = Math.min(
      100,
      (waiting / Math.max(1, usable.length)) * 30 + arrivals * 5 + closedCount * 14,
    );
    const score = Math.round(prev * 0.35 + raw * 0.65);
    prev = score;
    const level = levelFromScore(score);

    points.push({
      hour,
      label: `+${hour}h`,
      current: hour <= 12 ? score : null, // "observed" portion of the series
      predicted: score,
      level,
      arrivals,
      waiting,
      berthed,
      usable_berths: usable.length,
      drivers: [
        `${arrivals} arrival${arrivals === 1 ? "" : "s"} in window`,
        `${waiting} vessel${waiting === 1 ? "" : "s"} queueing`,
        `${berthed} berth${berthed === 1 ? "" : "s"} working`,
        closedCount ? `${closedCount} berth${closedCount > 1 ? "s" : ""} out of service` : "full capacity",
      ],
    });
  }

  return points;
}
