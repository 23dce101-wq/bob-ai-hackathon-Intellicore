# Source Code — PortPredict AI

This directory contains the complete source code for PortPredict AI, organized as a TypeScript full-stack monorepo.

## Structure

```
src/
├── backend/                  # Node.js + Express API server & AI gateway
│   ├── ai/
│   │   ├── index.ts          # Unified AI gateway (Ollama → WatsonX fallback)
│   │   ├── ollama.ts         # Ollama local streaming
│   │   └── watsonx.ts        # IBM watsonx.ai streaming gateway
│   ├── lib/port/
│   │   ├── generator.ts      # Berth infrastructure generator (6 berths, 0 synthetic vessels)
│   │   ├── schedule.ts       # Single-source-of-truth deterministic schedule builder
│   │   ├── congestion.ts     # Multi-factor berth & port congestion scoring
│   │   ├── prediction.ts     # Rolling 72h forecast in 6h intervals
│   │   ├── drivers.ts        # Ranked bottleneck driver extraction with metrics
│   │   ├── optimize.ts       # Greedy berth reassignment conflict optimizer
│   │   ├── state.server.ts   # Scenario disruption state manager (applyScenario → assignVesselsToBerths)
│   │   └── types.ts          # TypeScript interfaces and domain types
│   ├── routes/
│   │   ├── port-state.ts     # GET /api/port/state endpoint handler
│   │   ├── copilot.ts        # POST /api/ai/copilot streaming endpoint
│   │   └── plan.ts           # POST /api/ai/plan 72h shift plan streaming endpoint
│   ├── index.ts              # Express server entry point (loads dotenv)
│   ├── package.json          # Backend dependencies
│   └── tsconfig.json         # TypeScript configuration
├── frontend/                 # React 19 + Vite + Tailwind CSS Single-Page App
│   ├── src/
│   │   ├── components/
│   │   │   ├── port/         # Port domain components (Gantt, Simulation, Copilot, etc.)
│   │   │   └── ui/           # Reusable Radix UI / shadcn design system components
│   │   ├── routes/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Simulation.tsx
│   │   │   ├── Optimisation.tsx
│   │   │   ├── Copilot.tsx
│   │   │   └── Controls.tsx
│   │   ├── lib/port/port-context.tsx  # State context with localStorage persistence
│   │   └── main.tsx          # Application entry point
│   ├── package.json          # Frontend dependencies
│   └── vite.config.ts        # Vite configuration with API proxy
├── .env.example              # Template for environment configuration
└── package.json              # Monorepo runner scripts (npm run dev, npm run install:all)
```

## Quick Start

```bash
# Install dependencies across all packages
npm run install:all

# Run backend (port 3001) and frontend (port 5173) concurrently
npm run dev
```
