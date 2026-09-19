import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, BarChart3, Brain, ChevronRight, Container, Clock, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const features = [
    {
      icon: <Container className="size-6" />,
      title: "Vessel Management",
      description: "Track 100+ vessels with real-time status, berth assignments, and cargo details",
    },
    {
      icon: <BarChart3 className="size-6" />,
      title: "Congestion Prediction",
      description: "72-hour forecast with berth utilization, queue times, and bottleneck analysis",
    },
    {
      icon: <Brain className="size-6" />,
      title: "AI Optimization",
      description: "Local AI-powered berth allocation, crane rebalancing, and macro-routing strategies",
    },
    {
      icon: <Clock className="size-6" />,
      title: "Live Simulation",
      description: "Interactive terminal view with vessel movements, crane operations, and yard status",
    },
  ];

  const stats = [
    { value: "104+", label: "Vessels Tracked" },
    { value: "6", label: "Active Berths" },
    { value: "72h", label: "Forecast Window" },
    { value: "5", label: "Scenario Types" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Anchor className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">PortPredict AI</h1>
              <p className="text-xs text-muted-foreground">Intellicore Team</p>
            </div>
          </div>
          <Button onClick={() => navigate("/dashboard")} size="lg">
            Start Demo <ChevronRight className="ml-2 size-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
            <Zap className="size-4" />
            IBM Bob AI Hackathon 2026
          </div>
          <h2 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Container Congestion Predictor
            <br />
            <span className="text-primary">& Port Operations Optimiser</span>
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Predict container ship congestion 72 hours ahead and get an optimised berth and crane
            allocation plan, powered by local AI (Ollama).
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button onClick={() => navigate("/dashboard")} size="lg" className="px-8">
              Launch Dashboard <ChevronRight className="ml-2 size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="px-8"
              onClick={() => {
                const el = document.getElementById("team-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Users className="mr-2 size-4" /> Meet the Team
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-6 text-center transition-colors hover:border-primary/50"
            >
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="mb-16">
          <h3 className="mb-8 text-center text-2xl font-semibold">Key Capabilities</h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`rounded-xl border bg-card p-6 transition-all ${
                  hoveredFeature === index
                    ? "border-primary shadow-lg scale-[1.02]"
                    : "border-border hover:border-primary/30"
                }`}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h4 className="mb-2 font-semibold">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Problem Statement */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <h3 className="mb-4 text-xl font-semibold">The Problem</h3>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-4 text-muted-foreground">
                Port congestion costs the global shipping industry <span className="font-semibold text-destructive">$15+ billion annually</span> in
                delays, fuel waste, and operational inefficiencies. Traditional port management relies
                on manual coordination and reactive decision-making.
              </p>
              <p className="text-muted-foreground">
                Our system provides <span className="font-semibold text-primary">72-hour predictive insights</span> and
                AI-powered optimization to reduce berth waiting times, prevent congestion buildup,
                and improve overall port throughput.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-destructive/5 p-3">
                <div className="mt-0.5 size-2 shrink-0 rounded-full bg-destructive" />
                <div>
                  <p className="text-sm font-medium">Without Prediction</p>
                  <p className="text-xs text-muted-foreground">Reactive decisions, longer wait times, wasted resources</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-success/5 p-3">
                <div className="mt-0.5 size-2 shrink-0 rounded-full bg-success" />
                <div>
                  <p className="text-sm font-medium">With PortPredict AI</p>
                  <p className="text-xs text-muted-foreground">Proactive planning, optimized allocations, reduced costs</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team */}
        <div id="team-section" className="mt-16 text-center">
          <h3 className="mb-4 text-xl font-semibold">Team Intellicore</h3>
          <div className="flex flex-wrap justify-center gap-6">
            {["Jay Prajapati", "Nency Patel", "Aeni Patel", "Dishva Vasoya"].map((name) => (
              <div key={name} className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {name.charAt(0)}
                </div>
                <span className="text-sm">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background/80 py-6 text-center text-sm text-muted-foreground">
        <p>PortPredict AI — Built for IBM Bob AI Hackathon 2026</p>
      </footer>
    </div>
  );
}
