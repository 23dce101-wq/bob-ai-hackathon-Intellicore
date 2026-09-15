# Setup Guide — PortPredict AI

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Runtime for backend and frontend |
| npm | 9+ | Package manager |
| Git | 2.30+ | Version control |

### Optional (for AI features)

| Tool | Purpose |
|---|---|
| Ollama | Local AI inference (download from ollama.ai) |
| IBM Cloud Account | WatsonX API access |

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/23dce101-wq/bob-ai-hackathon-Intellicore.git
cd bob-ai-hackathon-Intellicore
```

### 2. Install Dependencies

```bash
cd src
npm run install:all
```

This installs dependencies for both backend and frontend.

### 3. Configure Environment Variables

```bash
cd src/backend
cp .env.example .env
```

Edit `src/backend/.env` with your credentials:

```env
# WatsonX (for AI copilot + shift planner)
WATSONX_APIKEY=your_api_key_here
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://eu-de.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-4-h-small

# Ollama (local fallback — install from ollama.ai)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b

# Server
PORT=3001
```

> The simulation, scheduling, and optimization work WITHOUT any API keys. Only the AI copilot and shift planner require WatsonX or Ollama.

### 4. Start the Application

```bash
cd src
npm run dev
```

This starts both servers concurrently:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

### 5. Verify It's Working

1. Open http://localhost:5173 in your browser
2. You should see the Dashboard tab with the KPI strip
3. Navigate to Simulation tab — click Play to start the terminal animation
4. Go to Controls tab — import a CSV file or add vessels manually
5. Go to AI Copilot — ask a question (requires Ollama or WatsonX)

## Using the Application

### Adding Vessels

**CSV Import:**
1. Go to Controls tab
2. Use the CSV Import panel to upload a vessel CSV file
3. Required columns: `vessel_id`, `type`, `cargo`, `eta_hours`, `priority`

**Manual Entry:**
1. Go to Controls tab
2. Use the Vessel Entry form to add individual vessels

### Running Scenarios

1. Go to Controls tab → Configure Berths panel
2. Close a berth (set status to "Closed") and click Apply
3. Navigate to Simulation — vessels will be diverted to open berths
4. Check Optimisation for reassignment recommendations

### AI Features

**Ollama (Local):**
```bash
# Install Ollama first
ollama pull qwen2.5:3b
ollama serve
```

**WatsonX (Cloud):**
Set `WATSONX_APIKEY` and `WATSONX_PROJECT_ID` in `.env`.

The system tries Ollama first, falls back to WatsonX automatically.

## Troubleshooting

| Issue | Solution |
|---|---|
| `npm run install:all` fails | Run `cd src/backend && npm install` then `cd ../frontend && npm install` separately |
| Port 5173 already in use | Kill the process or change port in frontend config |
| Port 3001 already in use | Kill the process or change PORT in backend .env |
| AI returns "not configured" | Either start Ollama (`ollama serve`) or set WatsonX credentials in .env |
| Simulation shows empty | Add vessels via CSV import or manual entry in Controls tab |
| Berth closure doesn't divert | Ensure the berth closure event is applied (click Apply in Configure Berths) |
