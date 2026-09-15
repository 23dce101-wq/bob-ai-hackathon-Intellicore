# PortPredict AI - Container Congestion Predictor & Port Operations Optimiser

> **Predictive container congestion and intelligent berth allocation dashboard for modern port operations teams, solving Problem Statement L1: Logistics & Ports.**

---

## Team

| Field | Value |
|---|---|
| **Team Name** | Intellicore |
| **Track** | AI |
| **Team Lead** | Jay Prajapati - 23dce101@charusat.edu.in |
| **Members** | Jay Prajapati, Nency Patel, Aeni Patel, Dishva Vasoya |

---

## Problem Statement (L1: Logistics & Ports)

The 2021 LA/Long Beach port backlog had 100+ ships waiting offshore for weeks, costing global supply chains $10B+. Port operators allocate berths, cranes, and yard space across hundreds of vessels manually in spreadsheets. Congestion hotspots are identified reactively — after vessels are already queuing — and alternate routing decisions come too late to help.

---

## Solution

Built with **IBM Bob** and **IBM watsonx.ai (IBM Granite 4-H-Small)**, **PortPredict AI** predicts congestion hotspots using vessel schedules and berth capacity data, recommends alternate routing strategies, optimises berth and crane assignments using an explainable heuristic, and generates a streaming 72-hour port operations plan and copilot for shift supervisors. Features a dual AI backend (Ollama local + WatsonX cloud) for resilient inference.

---

## Key Features

- **Explainable 72-Hour Congestion Forecasting:** Computes rolling 6-hour window congestion scores from mathematical arrival rates, service times, and usable crane capacity — with a clear breakdown explaining exactly why bottlenecks occur.
- **Root-Cause Bottleneck Driver Attribution:** Automatically ranks the top operational causes of terminal delay (e.g., crane outages, overlapping ultra-large container vessels, priority cargo displacement).
- **Automated Heuristic Berth Reassignment Optimizer:** Evaluates delayed vessels against compatible, earliest-available berths, calculating net waiting hours saved and crane allocation trade-offs with one-click schedule application.
- **Interactive Maritime Digital Twin & Disruption Simulator:** Real-time visual terminal simulation with timeline scrubbing, vessel/berth inspection drawers, Gantt schedule views, and dynamic scenario injection (berth closures, crane outages, vessel surges, and storms). When a berth closes, affected vessels are automatically diverted to open berths.
- **Dual AI Backend — IBM watsonx.ai + Ollama:** Streams production-grade 72-hour shift operations plans and answers operational triage questions in real time. WatsonX is primary, Ollama provides local fallback when cloud is unavailable.

---

## Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | TypeScript, JavaScript, HTML5, CSS3 |
| **Frameworks** | React 19, Vite, React Router, Node.js, Express, Tailwind CSS |
| **IBM Technologies** | watsonx.ai, IBM Granite 4-H-Small, IBM Bob |
| **State** | In-Memory Deterministic Port State Engine + localStorage Persistence |
| **Other** | Radix UI / shadcn/ui, Lucide React, Recharts, Ollama, Concurrently |

---

## Repository Structure

```
├── src/
│   ├── backend/                  # Node.js + Express API server & AI gateway
│   │   ├── ai/                   # Unified AI gateway (Ollama + WatsonX fallback)
│   │   ├── lib/port/             # Single-source-of-truth scheduling & optimization
│   │   └── routes/               # API routes (port-state, copilot, shift plan)
│   ├── frontend/                 # React 19 + React Router + Tailwind CSS SPA
│   │   ├── src/components/port/  # Simulation, Gantt chart, metrics, AI drawers
│   │   └── src/routes/           # Dashboard, Simulation, Optimisation, Copilot, Controls
│   ├── .env.example              # Template for environment configuration
│   └── package.json              # Monorepo runner scripts
├── docs/                         # Architectural and operational guides
├── demo/                         # Demo materials and screenshots
├── presentation/                 # Slide deck
└── submission.yaml               # Hackathon submission metadata
```

---

## How to Run

```bash
# 1. Clone the repository
git clone https://github.com/23dce101-wq/bob-ai-hackathon-Intellicore.git
cd bob-ai-hackathon-Intellicore

# 2. Navigate to source directory and install all dependencies
cd src
npm run install:all

# 3. Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your WATSONX_APIKEY and WATSONX_PROJECT_ID

# 4. Start backend and frontend concurrently
npm run dev
```

**Live Deployment:** https://bob-ai-hackathon-intellicore-seven.vercel.app/

**Frontend Dashboard:** http://localhost:5173
**Backend API Server:** http://localhost:3001

> The simulation, scheduling engine, and optimization run out of the box. Configuring watsonx.ai enables the AI copilot and shift planner. Ollama provides a local fallback when WatsonX is unavailable.

---

## Demo

| Artifact | Link |
|---|---|
| Demo Video | [Watch on Google Drive](https://drive.google.com/file/d/1_SeszmGZmT-9oOLbL7D8B1_KeVX7GxhU/view?usp=sharing) |
| Live Demo | [PortPredict AI — Live on Vercel](https://bob-ai-hackathon-intellicore-seven.vercel.app/) |
| Screenshots | See demo/screenshots/ |
| Presentation | See presentation/ |

---

## Known Limitations

- **Greedy Heuristic Optimization:** The berth reassignment algorithm uses an explainable greedy earliest-available matching heuristic rather than Mixed-Integer Linear Programming (MILP).
- **User-Provided Vessel Data:** Vessel data comes from CSV import or manual entry — no live AIS transponder feeds or commercial TOS (Terminal Operating System) integrations.
- **In-Memory State:** Server-side port state is generated fresh per request; localStorage preserves client-side state (events, custom vessels, berth closures) across page refreshes.

---

## What We're Most Proud Of

We are most proud of the tight synergy between deterministic maritime domain logic and IBM watsonx.ai. Rather than using LLMs for generic conversational filler, PortPredict AI feeds the exact mathematical schedule, crane capacity vectors, conflict logs, and scenario deltas into IBM Granite. This ensures zero hallucinations and allows the model to output operational 72-hour shift plans and real-time dispatcher recommendations that port controllers can immediately trust and act upon during severe weather or crane outage emergencies. The dual AI backend (Ollama + WatsonX) ensures the system works both online and offline.
