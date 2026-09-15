# Solution Overview — PortPredict AI

## Core Mechanism

PortPredict AI is a real-time port operations dashboard that combines a deterministic mathematical scheduling engine with IBM watsonx.ai foundation models to predict, visualise, and optimise port congestion.

The system operates on a **single-source-of-truth** principle: one `buildSchedule()` function produces the berth plan, simulation, Gantt chart, congestion scores, metrics, and AI context. No component can drift out of sync.

## How It Works

1. **Data Input:** Vessels are added via CSV import or manual entry. Each vessel has a type (Container/Bulk/Tanker), cargo, ETA, and priority. Berth infrastructure (B1-B6) is fixed port configuration.

2. **Scheduling:** The `buildSchedule()` function assigns vessels to compatible berths using greedy earliest-available matching. It accounts for crane capacity, yard saturation, vessel priority, and berth closures.

3. **Congestion Detection:** Rolling 6-hour window analysis computes congestion scores per berth and port-wide, ranking root-cause drivers (crane outages, overlapping arrivals, priority displacement).

4. **Optimization:** The greedy berth reassignment optimizer evaluates all delayed vessels against alternative compatible berths, calculating net waiting hours saved with one-click application.

5. **Simulation:** An interactive maritime digital twin visualizes the 72-hour schedule. Users can scrub the timeline, inject disruptions (berth closures, storms, crane failures), and see real-time vessel diversion.

6. **AI Integration:** WatsonX (primary) and Ollama (local fallback) provide streaming AI inference for the operations copilot and 72-hour shift planner, grounded in the actual port state data.

## Key Design Decisions

- **Deterministic over stochastic:** Every calculation is reproducible from the same inputs. No randomness means no surprises during demos or evaluations.
- **Greedy heuristic over MILP:** Explainable and instant. Port operators need to understand *why* a recommendation was made, not just receive an optimal answer they cannot verify.
- **Dual AI backend:** WatsonX for production-quality cloud inference, Ollama for offline/local resilience. The system gracefully degrades.

## User Experience

The dashboard presents five tabs: Dashboard (KPIs + forecast), Simulation (digital twin), Optimisation (one-click reassignment), AI Copilot (natural language Q&A), and Controls (vessel import + berth configuration). Every tab reads from the same underlying schedule, ensuring consistent information across views.
