# PortOptiAI — Setup & Demo Guide

## Requirements

- Node.js 20+ (or Bun)

## Run locally

```bash
bun install
bun run dev
```

Open http://localhost:8080 — the dashboard loads with a full synthetic port
(6 berths, 30 vessels, several scheduling conflicts). No database, no API keys,
no login. All data is synthetic; nothing connects to a real port feed.

## Endpoints

| Endpoint | What it does |
| --- | --- |
| `getPortState` (server function) | Berths, vessels, schedule, congestion, forecast, drivers, optimisation, scenario impact, ETA history |
| `POST /api/ai/plan` | Streams the AI-written 72-hour operations plan |
| `POST /api/ai/copilot` | Streams answers from the AI operations copilot |

Both AI endpoints accept `{ events: ScenarioEvent[] }` so the plan and the
copilot always describe the same disrupted state the dashboard is showing.

## Dashboard tour

1. **KPI strip** — congestion score, berths available, cranes working, vessels waiting, average wait, berth utilisation.
2. **What is driving congestion** — ranked causes with the numbers behind them.
3. **Live terminal simulation** — schedule-driven ships moving from anchorage to berth to departure. Scrub the timeline, change speed, toggle routes/labels/overlays, click a ship or berth to inspect it.
4. **72-hour forecast** — 6-hour windows with a "Why?" breakdown per window.
5. **Optimised berth allocation** — conflicts and metrics before vs after, per-move reasoning, apply or revert across the whole page.
6. **72-hour Gantt plan** — every berth's service windows, plus vessels that cannot be berthed.
7. **Simulate a disruption** — close a berth, knock out cranes, add a vessel surge, run a storm or delay a vessel; everything recalculates.
8. **Vessel queue & berth allocation tables** — click any vessel row for its full record.
9. **AI panels** — generate the 72-hour plan, or ask the copilot.

## 3-minute demo script

1. Point at the KPI strip and the drivers: "this is why the port is congested right now."
2. Scrub the simulation to +24h and +48h — show queues building at the tightest berth.
3. Open the forecast "Why?" panel for the worst window.
4. Click **Close B3 for 12h** — watch every panel recalculate and the extra waiting hours appear.
5. Hit **Apply optimised plan** — show conflicts, wait time and congestion dropping.
6. Generate the 72-hour plan, then ask the copilot "Which berth is most at risk in the next 24 hours?"

## Limitations

- Synthetic seeded data only — no real port, AIS or IoT integration.
- Congestion is a weighted, explainable formula; the optimiser is a greedy heuristic. Neither is machine learning.
- State is in-memory: reloading returns to the same baseline port.
