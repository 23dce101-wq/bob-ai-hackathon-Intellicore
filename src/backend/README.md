# PortPredict AI

Predictive container congestion and berth allocation dashboard for port operations teams.

## Tech Stack

- **Frontend**: React 19, Vite, TanStack Router, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Node.js + Express
- **AI**: IBM watsonx.ai — streaming operations copilot and 72-hour shift planner
- **Language**: TypeScript

## Getting Started

```sh
npm install
cp .env.example .env       # fill in your watsonx.ai credentials
npm run dev
```

The server runs on `http://localhost:3001` and the client on `http://localhost:5173`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WATSONX_API_KEY` | Your IBM watsonx.ai API key |
| `WATSONX_PROJECT_ID` | Your IBM watsonx.ai project ID |
| `WATSONX_URL` | API base URL (defaults to `https://us-south.ml.cloud.ibm.com`) |
| `WATSONX_MODEL` | Model ID (defaults to `ibm/granite-3-8b-instruct`) |

## Project Structure

```
├── frontend/          # React app (Vite + TanStack Router)
│   ├── src/
│   │   ├── components/   # UI and port-specific components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Port simulation logic
│   │   └── routes/       # TanStack Router file-based routes
│   └── vite.config.ts
├── backend/           # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes/           # API route handlers
│   └── ai/               # watsonx.ai gateway
└── package.json
```

## License

MIT
