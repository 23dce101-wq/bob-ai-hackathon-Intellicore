import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiPlanHandler } from "./routes/plan.js";
import { aiCopilotHandler } from "./routes/copilot.js";
import { portStateHandler } from "./routes/port-state.js";

const app = express();
const PORT = process.env["PORT"] || 3001;

app.use(cors({ origin: process.env["ALLOWED_ORIGIN"] || "http://localhost:5173" }));
app.use(express.json({ limit: "512kb" }));

// AI routes
app.post("/api/ai/plan", aiPlanHandler);
app.post("/api/ai/copilot", aiCopilotHandler);

// Port state API
app.post("/api/port-state", portStateHandler);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
