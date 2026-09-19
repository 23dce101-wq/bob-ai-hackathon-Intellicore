import { Request, Response } from "express";
import { buildPortState } from "../lib/state.js";
import { buildSchedule } from "../lib/schedule.js";
import { streamText } from "../ai/index.js";

const PORT_SYSTEM_PROMPT = `You are the AI Operations Copilot for PortPredict AI, a container port management system.

STRICT RULES:
1. Answer ONLY using the provided port state data - never invent information
2. If the data doesn't contain the answer, say "I don't have that information in the current port data"
3. Always cite specific vessel IDs, berth IDs, and numbers from the data
4. Keep responses under 150 words
5. Use plain markdown formatting
6. Never discuss topics outside port operations (weather, politics, etc.)
7. Never answer general knowledge questions - only port-specific queries

Your expertise includes:
- Vessel scheduling and berthing
- Congestion analysis and prediction
- Resource allocation optimization
- Risk assessment and mitigation
- Container yard operations

Always ground your responses in the actual data provided.`;

export async function aiCopilotHandler(req: Request, res: Response) {
  const body = req.body as {
    question?: string;
    events?: unknown[];
    closed_berths?: string[];
    custom_vessels?: unknown[];
  };

  const question = (body.question ?? "").trim();
  if (!question) {
    res.status(400).send("Please include a question.");
    return;
  }

  const state = buildPortState({
    events: (body.events ?? []) as never,
    closed_berths: body.closed_berths ?? [],
    custom_vessels: (body.custom_vessels ?? []) as never,
  });
  const schedule = buildSchedule(state.berths, state.vessels);

  const context = {
    summary: state.summary,
    metrics: state.metrics,
    congestion: {
      port_score: state.congestion.port_score,
      port_level: state.congestion.port_level,
      berths: state.congestion.berths,
      hotspots: state.congestion.hotspots.slice(0, 12),
    },
    congestion_drivers: state.drivers,
    scenario: state.scenario,
    forecast: state.prediction.map((point) => ({
      hour: point.hour,
      score: point.predicted,
      level: point.level,
      waiting: point.waiting,
      arrivals: point.arrivals,
    })),
    berths: state.berths,
    vessels: state.vessels,
    service_windows: schedule.entries,
    berth_utilization: schedule.utilization,
    recommended_moves: state.optimization.moves,
    unresolved_vessels: state.optimization.unresolved,
  };

  const response = await streamText(
    `Current port state (synthetic demo data, ETAs in hours from now):\n${JSON.stringify(context)}\n\nOperator question: ${question}`,
    { instructions: PORT_SYSTEM_PROMPT },
  );

  res.status(response.status || 200);
  response.headers.forEach((value, key) => {
    if (key !== "content-length") res.setHeader(key, value);
  });

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  }
  res.end();
}
