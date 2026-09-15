# Presentation — PortPredict AI

Place your final presentation slide deck here as `slides.pdf` or `slides.pptx`.

## Presentation Deck Structure

- **Slide 1: Title & Hook**
  - **Title:** PortPredict AI — Container Congestion Predictor & Port Operations Optimiser (Problem Statement L1)
  - **Team:** Intellicore | Track: AI
  - **Members:** Jay Prajapati (Lead), Nency Patel, Aeni Patel, Dishva Vasoya
  - **Tagline:** Transforming reactive maritime firefighting into proactive 72-hour operational mastery with IBM watsonx.ai.
- **Slide 2: The Multi-Billion Dollar Maritime Problem**
  - 2021 LA/Long Beach backlog: 100+ ships waiting offshore for weeks, \$10B+ supply chain losses.
  - Port operators allocate berths, cranes, and yard space across hundreds of vessels manually in spreadsheets.
  - Congestion hotspots identified reactively — after vessels are already queuing.
- **Slide 3: The Solution — PortPredict AI**
  - Explainable 72-Hour Congestion Forecasting based on vessel schedules and berth capacity.
  - Single-Source-of-Truth mathematical scheduling engine (`buildSchedule`).
  - Alternate routing strategies and greedy berth/crane reassignment optimizer.
  - Digital Twin terminal simulation with scenario stress-testing.
- **Slide 4: Technical Architecture**
  - Clean separation: React 19 Frontend + Express Node.js Backend.
  - In-memory deterministic simulation & queue scheduling engine.
  - Grounded context injection into IBM watsonx.ai foundation models via streaming SSE.
- **Slide 5: Live Demonstration Highlights**
  - Scrubbing the 72-hour terminal timeline.
  - Injecting severe weather and Berth 3 closure.
  - Auto-calculating waiting hours saved with one-click optimization.
- **Slide 6: IBM Technology Deep Dive**
  - **IBM watsonx.ai:** Grounded execution with `ibm/granite-3-8b-instruct`.
  - **72-Hour Shift Planner:** Generates markdown operational plans for shift handovers.
  - **Operations Copilot:** Real-time interactive natural language triage for port controllers.
  - **IBM Bob:** Accelerated end-to-end full-stack development and algorithm design.
- **Slide 7: Business Value & Operational Impact**
  - Up to 35% reduction in vessel queue waiting times.
  - Millions saved in demurrage fees and fuel consumption at anchorage.
  - Zero hallucination risk through grounded deterministic context.
- **Slide 8: Team & Future Roadmap**
  - **Team Intellicore:** Jay Prajapati (Lead), Nency Patel, Aeni Patel, Dishva Vasoya.
  - **Next Steps:** Real-time AIS transponder stream ingestion, TOS (Navis N4) connector, and MILP (Mixed Integer Linear Programming) solver extension.


