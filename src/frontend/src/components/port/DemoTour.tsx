import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Step {
  path: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    path: "/dashboard",
    title: "Dashboard — KPI Overview",
    description:
      "The KPI strip shows the live Port Congestion Score, available berths, working cranes, and queued vessels. The congestion driver list below it explains exactly what is causing pressure right now.",
  },
  {
    path: "/simulation",
    title: "Terminal Digital Twin",
    description:
      "Scrub the timeline slider between 0 h and 72 h to watch vessels move from anchorage to their assigned berths and depart after cargo discharge. The yard saturation panel below shows real-time TEU fill levels.",
  },
  {
    path: "/optimisation",
    title: "Berth Optimisation & Gantt",
    description:
      "The Gantt chart shows every vessel's 72-hour service window. The Optimised Berth Allocation panel proposes greedy reassignments \u2014 click 'Apply optimised plan' to see waiting hours drop across the dashboard.",
  },
  {
    path: "/copilot",
    title: "AI Copilot & Scenario Engine",
    description:
      'Ask the copilot questions like "Which berth has the highest risk in the next 24 hours?" or inject disruptions — close Berth 3, trigger a crane failure, or add a vessel surge — and watch the congestion score react in real time.',
  },
  {
    path: "/controls",
    title: "Controls — Shift Planner & Data Import",
    description:
      'Add custom vessels manually or import a CSV, adjust berth configurations, and then click "Generate 72-hour plan" to stream an AI-written operational shift plan grounded in the live port state.',
  },
];

interface DemoTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoTour({ isOpen, onClose }: DemoTourProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const current = STEPS[step]!;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const goTo = (idx: number) => {
    setStep(idx);
    navigate(STEPS[idx]!.path);
  };

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 pb-8 sm:items-center sm:pb-0"
      onClick={handleClose}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">
            Demo tour · step {step + 1} of {STEPS.length}
          </p>
          <button
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close demo tour"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          <h3 className="mb-2 text-base font-semibold">{current.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{current.description}</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 pb-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`size-1.5 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-border"}`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" disabled={isFirst} onClick={() => goTo(step - 1)}>
            <ChevronLeft className="size-4" /> Back
          </Button>
          {isLast ? (
            <Button size="sm" onClick={handleClose}>
              Finish tour
            </Button>
          ) : (
            <Button size="sm" onClick={() => goTo(step + 1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
