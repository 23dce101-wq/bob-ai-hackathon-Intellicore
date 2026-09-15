import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Anchor,
  Brain,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Settings,
  X,
  Home,
} from "lucide-react";
import { usePortState } from "@/lib/port/port-context";
import { DemoTour } from "@/components/port/DemoTour";
import { Pill } from "@/components/port/StatusBadge";
import type { PortStatePayload, ScenarioEvent, Vessel } from "@/lib/port/types";

type TabId = "dashboard" | "simulation" | "optimisation" | "copilot" | "controls";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const TABS: Tab[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" />, path: "/dashboard" },
  { id: "simulation", label: "Simulation", icon: <Play className="size-4" />, path: "/simulation" },
  { id: "optimisation", label: "Optimisation", icon: <Brain className="size-4" />, path: "/optimisation" },
  { id: "copilot", label: "AI Copilot", icon: <MessageSquare className="size-4" />, path: "/copilot" },
  { id: "controls", label: "Controls", icon: <Settings className="size-4" />, path: "/controls" },
];

interface Toast {
  id: string;
  message: string;
  type: "success" | "info" | "warning";
}

let toastCounter = 0;

async function fetchPortState(
  events: ScenarioEvent[],
  customVessels: Vessel[],
): Promise<PortStatePayload> {
  const API = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${API}/api/port-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      events,
      closed_berths: [],
      custom_vessels: customVessels.map((v) => ({
        vessel_id: v.vessel_id,
        type: v.type,
        cargo: v.cargo,
        eta_hours: v.eta_hours,
        priority: v.priority,
      })),
    }),
  });
  if (!res.ok) throw new Error(`Port state request failed: ${res.status}`);
  return res.json() as Promise<PortStatePayload>;
}

export function AppLayout({
  activeTab,
  children,
}: {
  activeTab: TabId;
  children: React.ReactNode;
}) {
  const {
    events, customVessels, applied,
    resetAll, setPortData, setQueryState,
  } = usePortState();

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDemoTour, setShowDemoTour] = useState(false);

  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ["port-state", JSON.stringify(events), JSON.stringify(customVessels)],
    queryFn: () => fetchPortState(events, customVessels),
    staleTime: 60_000,
  });

  // Push fetched data into context so pages can access it
  useEffect(() => {
    setPortData(data ?? null);
  }, [data, setPortData]);

  useEffect(() => {
    setQueryState({ isPending, isFetching, error });
  }, [isPending, isFetching, error, setQueryState]);

  const handleNewScenario = useCallback(() => {
    resetAll();
    addToast("All data cleared", "success");
  }, [resetAll, addToast]);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-surface/60"
              aria-label="Go to home page"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Anchor className="size-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">PortPredict AI</h1>
              </div>
            </Link>
            {isFetching && <Loader2 className="size-3 animate-spin text-primary" aria-hidden />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <Home className="size-3" /> Home
            </Link>
            <button
              onClick={handleNewScenario}
              className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/10"
            >
              <RefreshCw className="size-3" /> New Scenario
            </button>
            <button
              onClick={() => setShowDemoTour(true)}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            >
              <Play className="size-3" /> Demo Tour
            </button>
            {events.length > 0 && <Pill variant="warning">{events.length} disruption active</Pill>}
            {applied && <Pill variant="success">Optimised plan applied</Pill>}
            <Pill variant="info">Synthetic demo</Pill>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="sticky top-[52px] z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 lg:px-8">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.path}
              className={`flex min-w-0 shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
        <div className={isFetching ? "space-y-4 opacity-70 transition-opacity" : "space-y-4"}>
          {children}
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all ${
              toast.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : toast.type === "warning"
                  ? "border-warning/30 bg-warning/10 text-warning"
                  : "border-info/30 bg-info/10 text-info"
            }`}
          >
            <span className="text-sm">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Demo Tour */}
      <DemoTour
        isOpen={showDemoTour}
        onClose={() => setShowDemoTour(false)}
      />
    </main>
  );
}
