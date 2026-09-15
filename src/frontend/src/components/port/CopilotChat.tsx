import { useState, useRef, useEffect } from "react";
import { Copy, Loader2, Send, ThumbsUp, ThumbsDown, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CongestionResult, OptimizationResult, ScenarioEvent, Vessel } from "@/lib/port/types";
import { SimpleMarkdown } from "./SimpleMarkdown";

interface Turn {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Which berth is most at risk in the next 24 hours?",
  "Why is the worst-delayed vessel waiting?",
  "What should I do in the next 12 hours?",
  "Summarise the impact of the active disruption.",
];

export function CopilotChat({
  events,
  customVessels,
  applied,
  optimization,
  congestion,
  vessels,
}: {
  events: ScenarioEvent[];
  customVessels: Vessel[];
  applied?: boolean;
  optimization?: OptimizationResult;
  congestion?: CongestionResult;
  vessels?: Vessel[];
}) {
  const [turns, setTurns] = useState<Turn[]>(() => {
    const saved = sessionStorage.getItem("copilot-turns");
    return saved ? JSON.parse(saved) : [];
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem("copilot-turns", JSON.stringify(turns));
  }, [turns]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns]);

  // Contextual suggestions based on port state
  const contextualSuggestions = (() => {
    const base: string[] = [];
    if (congestion && congestion.berths.length > 0) {
      const worstBerth = [...congestion.berths].sort((a, b) => b.score - a.score)[0];
      if (worstBerth && worstBerth.score > 50) {
        base.push(`Why is ${worstBerth.berth_id} the most congested berth?`);
      }
    }
    if (vessels && vessels.length > 0) {
      const worstVessel = [...vessels].sort((a, b) => b.wait_time_hours - a.wait_time_hours)[0];
      if (worstVessel && worstVessel.wait_time_hours > 10) {
        base.push(`Why is ${worstVessel.vessel_id} waiting ${worstVessel.wait_time_hours}h?`);
      }
    }
    if (events.length > 0) {
      base.push("Summarise the impact of the active disruption.");
    }
    while (base.length < 4) {
      const next = SUGGESTIONS[base.length % SUGGESTIONS.length] ?? "What are the key metrics?";
      if (!base.includes(next)) base.push(next);
      else {
        const fallback = SUGGESTIONS.find((s) => !base.includes(s)) ?? "What are the key metrics?";
        base.push(fallback);
      }
    }
    return base.slice(0, 4);
  })();

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion("");
    setTurns((t) => [...t, { role: "user", text }, { role: "assistant", text: "" }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          events,
          applied: applied ?? false,
          custom_vessels: customVessels.map((v) => ({
            vessel_id: v.vessel_id,
            type: v.type,
            cargo: v.cargo,
            eta_hours: v.eta_hours,
            priority: v.priority,
          })),
          optimization_summary: applied && optimization ? {
            hours_saved: optimization.hours_saved_total,
            moves_count: optimization.moves.length,
          } : null,
        }),
      });
      if (!res.ok || !res.body) {
        const msg = (await res.text()) || "The copilot could not answer.";
        setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, text: msg } : turn)));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, text: acc } : turn)));
      }
    } catch {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { ...turn, text: "Network problem reaching the copilot. [Retry]" }
            : turn,
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const retryLast = () => {
    const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
    if (lastUserTurn) {
      setTurns((t) => t.slice(0, -2));
      ask(lastUserTurn.text);
    }
  };

  const copyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <section className="panel flex flex-col p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide uppercase">AI operations copilot</h2>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
            Ollama (local)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTurns([]);
            sessionStorage.removeItem("copilot-turns");
          }}
          className="text-xs text-muted-foreground"
        >
          Clear chat
        </Button>
      </header>

      <div className="mb-3 max-h-80 min-h-24 flex-1 space-y-3 overflow-auto rounded-md border border-border bg-surface/60 p-3">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {contextualSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <p key={i} className="text-sm font-medium">
              {t.text}
            </p>
          ) : (
            <div key={i} className="border-l-2 border-primary/50 pl-3">
              {t.text ? (
                <>
                  <SimpleMarkdown text={t.text} />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => copyResponse(t.text)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Copy response"
                    >
                      <Copy className="size-3" />
                    </button>
                    <button className="text-muted-foreground hover:text-success" aria-label="Helpful">
                      <ThumbsUp className="size-3" />
                    </button>
                    <button className="text-muted-foreground hover:text-destructive" aria-label="Not helpful">
                      <ThumbsDown className="size-3" />
                    </button>
                    {t.text.includes("problem") || t.text.includes("failed") || t.text.includes("Retry") ? (
                      <button
                        onClick={retryLast}
                        className="text-xs text-primary underline"
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  Thinking…
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {/* Always-visible suggestions below chat */}
      {turns.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {contextualSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a vessel, berth or delay…"
          aria-label="Ask the operations copilot"
        />
        <Button type="submit" disabled={loading || !question.trim()}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          Ask
        </Button>
      </form>
    </section>
  );
}
