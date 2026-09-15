# Application Screenshots — PortPredict AI

This directory contains visual captures of PortPredict AI in operation.

## Required Screenshots

At least 3 screenshots are required for submission. Name them sequentially:

### 1. `01-dashboard-overview.png`
**What to capture:** The Dashboard tab showing:
- KPI strip (Port Congestion Score, Available Berths, Working Cranes, Queued Vessels)
- 72-hour congestion forecast chart
- Top congestion drivers list
- Berth utilization breakdown

### 2. `02-terminal-simulation.png`
**What to capture:** The Simulation tab showing:
- Interactive maritime terminal digital twin with vessels at berths and anchorage
- Fleet Activity summary (Inbound, Waiting, Berthed, Departing, Stranded)
- Live Terminal Status (TEUs discharged, Active cranes, Throughput rate)
- Container yard visualization with utilization percentages

### 3. `03-optimisation-results.png`
**What to capture:** The Optimisation tab showing:
- 72-hour berth plan Gantt chart
- Optimised berth allocation panel with hours saved
- Vessel reassignment recommendations
- "Apply optimised plan" button

### 4. `04-controls-import.png`
**What to capture:** The Controls tab showing:
- CSV Import panel with test data
- Vessel Entry form
- Configure Berths panel (showing a berth closure)
- Scenario injection controls

### 5. `05-ai-copilot.png`
**What to capture:** The AI Copilot tab showing:
- Natural language question input
- Streaming AI response with port-specific answer
- AI backend indicator (Ollama local / WatsonX cloud)
- Preset demo scenarios panel

### 6. `06-berth-closure-diversion.png`
**What to capture:** Simulation with a berth closed showing:
- Closed berth marked in red with hatching
- Vessels diverted to other berths
- Fleet Activity showing stranded count
- Berth configuration panel showing the closure

## How to Take Screenshots

1. Start the application (`cd src && npm run dev`)
2. Add test vessels via CSV import (use `testing/vessels-quick-test.csv`)
3. Navigate to each tab and capture the screen
4. Use browser developer tools to set viewport to 1920x1080 for consistent sizing
5. Save as PNG in this directory with the naming convention above
