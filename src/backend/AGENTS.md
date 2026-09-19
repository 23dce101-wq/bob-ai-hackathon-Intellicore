# Project Guidelines — PortPredict AI

## Architecture

- **Frontend**: React + Vite in `frontend/` — TanStack Router for routing, Tailwind CSS + shadcn/ui for styling
- **Backend**: Express server in `backend/` — serves API routes and proxies to the frontend in dev
- **AI Integration**: IBM watsonx.ai for streaming AI responses (operations copilot + shift planner)

## Development

```sh
npm install
npm run dev        # starts both backend (port 3001) and client (port 5173)
```

## AI Gateway

All AI calls go through `backend/ai/watsonx.ts`, which streams text from IBM watsonx.ai.
Requires `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` environment variables.
