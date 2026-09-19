# Architecture — PortPredict AI

## System Architecture

```mermaid
graph TD
    subgraph Frontend ["React 19 SPA — Vite + Tailwind CSS"]
        A[Dashboard] --> F[Port Context]
        B[Simulation] --> F
        C[Optimisation] --> F
        D[AI Copilot] --> F
        E[Controls] --> F
        F -->|POST /api/port-state| G[Express Backend]
        F -->|POST /api/ai/copilot| G
        F -->|POST /api/ai/plan| G
    end

    subgraph Backend ["Node.js + Express API Server"]
        G --> H[Port State Handler]
        G --> I[Copilot Handler]
        G --> J[Plan Handler]
        H --> K[buildPortState]
        K --> L[generatePortData]
        K --> M[applyScenario]
        K --> N[assignVesselsToBerths]
        K --> O[detectCongestion]
        K --> P[optimizeAllocation]
        K --> Q[buildSchedule]
        I --> R[AI Gateway]
        J --> R
    end

    subgraph AI ["Dual AI Backend"]
        R --> S[Ollama Local]
        R --> T[WatsonX Cloud]
        S -->|fallback| T
    end

    subgraph State ["State Management"]
        F -->|localStorage| U[Events Persistence]
        F -->|localStorage| V[Custom Vessels]
        K -->|per request| W[In-Memory Engine]
    end

    style Frontend fill:#1a1a2e,stroke:#0f3460,color:#fff
    style Backend fill:#16213e,stroke:#0f3460,color:#fff
    style AI fill:#0f3460,stroke:#e94560,color:#fff
    style State fill:#1a1a2e,stroke:#533483,color:#fff
```

## Component Table

| Component | Technology | Responsibility |
|---|---|---|
| Frontend SPA | React 19 + Vite | User interface, routing, state management |
| Styling | Tailwind CSS + shadcn/ui | Responsive design, dark theme |
| Routing | React Router | Client-side navigation (5 tabs) |
| State Context | React Context + localStorage | Persistent events, custom vessels, berth closures |
| API Server | Express (Node.js) | HTTP endpoints, request validation |
| Scheduling Engine | TypeScript (pure functions) | Berth assignment, queue management, conflict detection |
| Congestion Detector | TypeScript (pure functions) | Rolling window scoring, driver attribution |
| Optimizer | TypeScript (pure functions) | Greedy berth reassignment, hours-saved calculation |
| Simulation | React + SVG | Interactive maritime digital twin with timeline |
| AI Gateway | TypeScript | Unified interface to Ollama/WatsonX with fallback |
| WatsonX | IBM watsonx.ai API | Streaming AI inference for copilot and planner |
| Ollama | Local LLM server | Offline AI inference fallback |

## Data Flow

1. **User adds vessels** (CSV import or manual entry) → stored in `localStorage` + React context
2. **Events created** (berth closures, crane outages, weather) → stored in `localStorage`
3. **API request** sent to `POST /api/port-state` with events + custom vessels
4. **Backend generates berth infrastructure** (B1-B6 fixed specs)
5. **Scenario applied** (closures null out affected vessel assignments)
6. **Vessels auto-assigned** to compatible open berths via greedy algorithm
7. **Schedule computed** (`buildSchedule`) — single source of truth
8. **Congestion detected** — rolling 6-hour window scores
9. **Optimization evaluated** — reassignment moves with hours saved
10. **Full state returned** to frontend — all views render from same data
