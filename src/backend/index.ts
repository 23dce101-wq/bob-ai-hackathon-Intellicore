import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiPlanHandler } from "./routes/plan.js";
import { aiCopilotHandler } from "./routes/copilot.js";
import { portStateHandler } from "./routes/port-state.js";
import { vesselsRouter } from "./routes/vessels.js";
import { connectDB, isDBConnected } from "./lib/db.js";

const app = express();
const PORT = process.env["PORT"] || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: "512kb" }));

// AI routes
app.post("/api/ai/plan", aiPlanHandler);
app.post("/api/ai/copilot", aiCopilotHandler);

// Port state API
app.post("/api/port-state", portStateHandler);

// Vessel CRUD API (MongoDB)
app.use("/api/vessels", vesselsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mongodb: isDBConnected() ? "connected" : "fallback/disconnected",
    timestamp: Date.now(),
  });
});

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
