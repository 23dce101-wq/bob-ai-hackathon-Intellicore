# PortPredict AI — Complete System Audit & Improvement Plan

> Every identified problem across all 6 tabs + system-wide, with non-patchy end-to-end solutions.
> Generated from a full codebase review of all frontend components, backend routes, and data pipeline.

---

## Table of Contents

1. [Landing Page](#1-landing-page)
2. [Dashboard Tab](#2-dashboard-tab)
3. [Simulation Tab](#3-simulation-tab)
4. [Optimisation Tab](#4-optimisation-tab)
5. [AI Copilot Tab](#5-ai-copilot-tab)
6. [Reports Tab](#6-reports-tab)
7. [Cross-Cutting / System-Wide](#7-cross-cutting--system-wide)
8. [Priority Implementation Order](#8-priority-implementation-order)

---

## 1. Landing Page

### L1 — No loading state when transitioning to dashboard

**Problem:** Clicking "Start Demo" or "Launch Dashboard" causes a blank flash while the first API call resolves. The user sees nothing for 1-3 seconds.

**Solution:** Show a skeleton loading screen immediately after `setShowLanding(false)` is called, before the API response arrives. The `isPending` state in `index.tsx` already handles this, but the transition is jarring because the landing page unmounts instantly.

- In `index.tsx`, after `setShowLanding(false)`, render a full-page skeleton loader immediately instead of waiting for `isPending` to resolve.
- The skeleton should match the Dashboard layout: 7 KPI card placeholders, a drivers list placeholder, and two table placeholders.
- Use a `Transition` or CSS fade-out on the landing page so it dissolves into the skeleton rather than cutting to blank.

### L2 — "Meet the Team" scrolls but no visual indicator

**Problem:** Clicking "Meet the Team" smooth-scrolls to the team section, but there's no visual cue (arrow, highlight) to draw the eye downward.

**Solution:** After scrolling to the team section, add a brief pulse animation on the team member avatars (a subtle `scale(1.05)` bounce). Also add a small downward chevron arrow below the hero section that gently bounces to hint at scrollable content.

### L3 — Stats are hardcoded

**Problem:** The landing page shows "104+ Vessels", "6 Active Berths", "72h Forecast Window", "5 Scenario Types". These are hardcoded strings that don't reflect the actual generated data.

**Solution:** Pass the `PortDataset` to `LandingPage` as an optional prop (generated lazily on mount or pre-fetched). Derive stats from it:
- `vessels.length` instead of "104+"
- `berths.length` instead of "6"
- Keep "72h" and "5" as they're architectural constants
- If data isn't loaded yet, show the hardcoded values as fallbacks with a "+" suffix.

### L4 — No favicon or browser tab branding

**Problem:** Browser tab shows the default Vite icon. No visual identity in bookmarks or tab bars.

**Solution:** Create an SVG favicon (anchor icon matching the logo) and add it to `index.html`:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```
Also add Open Graph meta tags for social sharing.

### L5 — Footer has no repo link or team contact

**Problem:** Footer says "Built for IBM Bob AI Hackathon 2026" but provides no way to reach the team or view the code.

**Solution:** Add the GitHub repo URL and team email/contact to the footer:
```tsx
<footer>
  <p>PortPredict AI — Built for IBM Bob AI Hackathon 2026</p>
  <div className="flex gap-4 mt-2">
    <a href="https://github.com/...">GitHub</a>
    <a href="mailto:team@intellicore.dev">Contact</a>
  </div>
</footer>
```

### L6 — Feature card icons don't match tab icons

**Problem:** "Live Simulation" feature card uses a `Clock` icon, but the Simulation tab uses `Play`. "Vessel Management" uses `Container` but Dashboard tab uses `LayoutDashboard`. Visual inconsistency.

**Solution:** Align feature card icons with the actual tab navigation icons:
- Vessel Management → `LayoutDashboard` (matches Dashboard tab)
- Congestion Prediction → `BarChart3` (matches Reports tab icon concept)
- AI Optimization → `Brain` (matches Optimisation tab)
- Live Simulation → `Play` (matches Simulation tab)

---

## 2. Dashboard Tab

### D1 — VesselTable shows all 116 rows with no search or filter

**Problem:** The vessel table renders every single vessel. Judges can't quickly find "show me the delayed vessels" or "find V203". This is the #1 UX issue on the dashboard.

**Solution:** Add a filter bar above the VesselTable with:
- **Status filter tabs:** All | Waiting | Docked | En Route | Delayed (where Delayed = `wait_time_hours > 0`)
- **Type filter dropdown:** All | Container | Bulk | Tanker
- **Search input:** Filter by vessel ID or cargo name (client-side, no API call)
- **Summary counts:** Show "23 Waiting · 6 Docked · 87 Delayed" above the table

Implementation:
```tsx
// In VesselTable.tsx
const [filter, setFilter] = useState<"all" | "waiting" | "docked" | "enroute" | "delayed">("all");
const [typeFilter, setTypeFilter] = useState<"all" | VesselType>("all");
const [search, setSearch] = useState("");

const filtered = rows.filter(v => {
  if (filter === "waiting" && v.status !== "Waiting") return false;
  if (filter === "docked" && v.status !== "Docked") return false;
  if (filter === "enroute" && v.status !== "En Route") return false;
  if (filter === "delayed" && v.wait_time_hours <= 0) return false;
  if (typeFilter !== "all" && v.type !== typeFilter) return false;
  if (search && !v.vessel_id.toLowerCase().includes(search.toLowerCase()) 
      && !v.cargo.toLowerCase().includes(search.toLowerCase())) return false;
  return true;
});
```

### D2 — KPIs are static, no trend direction

**Problem:** The 7 KPI cards show numbers but no indication of whether things are getting better or worse after applying optimisation or scenarios.

**Solution:** Pass both `metrics_before` and `metrics_after` (or `congestion.before` / `congestion.after`) to KpiStrip. Add a mini trend arrow on each KPI:
- Green down arrow ▼ = improved (e.g., avg wait went from 85h to 65h)
- Red up arrow ▲ = worsened
- Gray dash — = unchanged

```tsx
// In KpiStrip.tsx, add optional `previous` prop
function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (current === previous) return <span className="text-muted-foreground">—</span>;
  const improved = current < previous;
  return improved 
    ? <TrendingDown className="size-3.5 text-success" /> 
    : <TrendingUp className="size-3.5 text-destructive" />;
}
```

### D3 — No "jump to simulation" link from allocation table

**Problem:** User sees berth B3 is at 100% utilisation in AllocationTable but has to manually click the Simulation tab, then find B3 in the SVG.

**Solution:** Make berth IDs in AllocationTable clickable. Clicking navigates to the Simulation tab and selects that berth:
```tsx
// In AllocationTable.tsx
const navigate = useNavigate();
<td onClick={() => {
  navigate({ to: "/", search: { tab: "simulation", berth: berth.berth_id } });
}}>
  <span className="font-bold text-primary cursor-pointer hover:underline">{berth.berth_id}</span>
</td>
```
Also add a small "View in simulation →" link at the bottom of the berth detail section.

### D4 — AllocationTable doesn't show current vessel

**Problem:** Berth rows show status, cranes, queue count, and utilisation — but not which vessel is currently docked there.

**Solution:** Add a "Current" column or show the current vessel ID in the berth row. Use `berth.current_vessel_id` which is already computed by `refreshBerthPointers()`:
```tsx
<td className="px-4 py-2.5 text-xs">
  {berth.current_vessel_id ? (
    <span className="num font-medium text-success">{berth.current_vessel_id}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  )}
</td>
```

### D5 — BerthUtilizationChart bars don't animate

**Problem:** When data changes (new scenario applied), the bar widths jump instantly to new values instead of transitioning smoothly.

**Solution:** The bars already have `transition-all duration-500` in the CSS class. The issue is that React re-renders the entire component at once. Add a `useEffect` that triggers a re-render with a slight delay for each bar:
```tsx
// Use CSS transition which is already there — the issue is the parent re-renders all at once.
// Solution: ensure bars use inline style with transition, which they already do.
// The real fix: make sure the data prop change triggers a state update, not a full remount.
// Since we use useMemo, the bars will transition if the width changes via inline style.
// Already works — verify by checking that the parent doesn't key-change the component.
```
Actually this should already work with the existing `transition-all duration-500`. Verify the parent isn't re-mounting the component (check that `BerthUtilizationChart` isn't inside a conditional that causes remount).

### D6 — Drivers section has no expand/collapse

**Problem:** The drivers list shows 5 detailed items with full text. On small screens or with many drivers, this takes up significant vertical space.

**Solution:** Collapse drivers after the top 2 by default, with a "Show all N drivers" toggle:
```tsx
const [expanded, setExpanded] = useState(false);
const visibleDrivers = expanded ? data.drivers : data.drivers.slice(0, 2);
// ... render visibleDrivers ...
{data.drivers.length > 2 && (
  <button onClick={() => setExpanded(!expanded)}>
    {expanded ? "Show less" : `Show all ${data.drivers.length} drivers`}
  </button>
)}
```

### D7 — VesselTable status can be stale after data regeneration

**Problem:** The `status` field on vessels is computed server-side in `detectCongestion()`. If the frontend regenerates data (New Scenario button), the status might not match the visual state.

**Solution:** This is already handled correctly — `detectCongestion()` recomputes status on every request. The issue is cosmetic: the VesselStatusBadge reads `vessel.status` directly. Ensure the status displayed always comes from the latest API response, not cached state. The current implementation is correct; just verify React Query invalidation works with the seed change.

### D8 — AllocationTable "Changes" column lacks context

**Problem:** Shows "+6" and "-3" for incoming/outgoing vessel reassignments, but doesn't explain what changed without reading the full optimization panel.

**Solution:** Add a tooltip on the change badges showing the specific vessel IDs:
```tsx
<div className="group relative">
  <span className="inline-flex ...">+{incoming.length}</span>
  <div className="hidden group-hover:block absolute z-10 ...">
    {incoming.map(m => <div key={m.vessel_id}>{m.vessel_id} → {berth.berth_id}</div>)}
  </div>
</div>
```

### D9 — No summary stats at top of VesselTable

**Problem:** User has to scan all 116 rows to understand the breakdown.

**Solution:** Add a summary bar at the top of VesselTable:
```tsx
const summary = {
  waiting: rows.filter(v => v.status === "Waiting").length,
  docked: rows.filter(v => v.status === "Docked").length,
  enroute: rows.filter(v => v.status === "En Route").length,
  delayed: rows.filter(v => v.wait_time_hours > 0).length,
};
// Render as: "23 Waiting · 6 Docked · 80 En Route · 87 Delayed"
```

### D10 — BerthUtilizationChart visually duplicates AllocationTable

**Problem:** Both show berth utilisation data, but in different formats (table vs bar chart). This is redundant and wastes vertical space.

**Solution:** Merge them into a single component. Replace the separate BerthUtilizationChart with an enhanced AllocationTable that includes inline bar charts in the "Utilisation" column (which it already has). Remove the standalone BerthUtilizationChart from the dashboard and instead make the AllocationTable's utilisation bars more prominent (taller, with labels).

### D11 — KPI "Yard capacity" doesn't show which blocks are saturated

**Problem:** Shows "69% occupied — All blocks below 90%" but when blocks ARE saturated, it just says "2 blocks saturated" without naming them.

**Solution:** Update the hint text to include specific block IDs:
```tsx
hint: summary.yard_saturation_blocks > 0
  ? `${yard.blocks.filter(b => b.used_teu/b.total_teu >= 0.9).map(b => b.block_id).join(", ")} saturated`
  : "All blocks below 90%"
```

### D12 — No dark/light mode toggle

**Problem:** The app is always dark-themed. Some judges prefer light mode, and it's an accessibility concern.

**Solution:** Add a theme toggle button in the header using CSS variables. The app already uses CSS variable-based colors (`var(--color-background)` etc.), so adding a `.light` class that remaps these variables to light-theme values is straightforward. Store preference in localStorage.

### D13 — VesselDetailSheet doesn't show routing strategy

**Problem:** The optimization panel computes `routing_strategy` for each vessel (slow steaming, anchorage holding, diversion), but VesselDetailSheet doesn't display it.

**Solution:** Pass `routing_strategy` to VesselDetailSheet and add a new section:
```tsx
{vessel.routing_strategy && vessel.routing_strategy.action !== "direct_berth" && (
  <section>
    <h3>Routing Advisory</h3>
    <Pill variant="info">{vessel.routing_strategy.action}</Pill>
    <p>{vessel.routing_strategy.rationale}</p>
    {vessel.routing_strategy.fuel_saved_tons > 0 && (
      <p>Saves {vessel.routing_strategy.fuel_saved_tons}t fuel</p>
    )}
  </section>
)}
```

### D14 — No "last updated" timestamp

**Problem:** User doesn't know if the data they're looking at is fresh or from minutes ago.

**Solution:** Add a timestamp in the header or footer showing when the last API response was received:
```tsx
const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
// In the query's onSuccess callback:
onSuccess: () => setLastUpdated(new Date()),
// In header:
<Pill variant="muted">Updated {lastUpdated.toLocaleTimeString()}</Pill>
```

### D15 — No export for AllocationTable or Berth chart

**Problem:** VesselTable has CSV export, but AllocationTable and BerthUtilizationChart don't.

**Solution:** Add export buttons to both:
- AllocationTable: Export berth allocation as CSV (berth, status, cranes, queue, utilisation)
- BerthUtilizationChart: Export utilisation comparison as CSV
- Use the same `downloadCSV` pattern from VesselTable

---

## 3. Simulation Tab

### S1 — Yard percentages don't match between SVG and YardPanel

**Problem:** The PortSimulation SVG computes yard saturation client-side using `baseUtil * (0.6 + 0.4 * unloadProgress)` while YardPanel uses the backend's canonical `YardStatus`. These produce different numbers for the same berth.

**Solution:** Pass `yard: YardStatus` from the parent to PortSimulation and use the canonical values:
```tsx
// In index.tsx, pass yard to PortSimulation:
<PortSimulation berths={data.berths} vessels={vessels} yard={data.yard} />

// In PortSimulation, use yard data for each berth's saturation:
const yardBlock = yard.blocks.find(b => b.serving_berths.includes(berth.berth_id));
const yardPct = yardBlock ? Math.round((yardBlock.used_teu / yardBlock.total_teu) * 100) : 0;
```
This eliminates the dual calculation entirely.

### S2 — PortSimulation doesn't receive optimization prop

**Problem:** When the optimised plan is applied, the simulation doesn't know which vessels were reassigned. It can't show reassignment indicators.

**Solution:** Pass `optimization: OptimizationResult` to PortSimulation. Use `optimization.moves` to identify reassigned vessels and add visual indicators:
```tsx
// In PortSimulation
const reassignedIds = new Set(optimization.moves.map(m => m.vessel_id));

// On vessel glyph, add glow/badge for reassigned vessels:
{reassignedIds.has(item.vessel.vessel_id) && (
  <circle r={length/2 + 6} fill="var(--color-info)" fillOpacity={0.15}>
    <animate ... />
  </circle>
)}
```

### S3 — Vessel labels overlap at anchorage

**Problem:** When many vessels are waiting at anchorage, their labels (vessel IDs) overlap and become unreadable.

**Solution:** Implement label collision detection:
```tsx
// After computing all placed vessels, detect label overlaps and offset them
const labelOffsets: Map<string, number> = new Map();
const anchorVessels = placed.filter(p => p.phase === "waiting" || p.phase === "stranded");
// Sort by y position, then check if any labels are within 14px of each other
// If so, offset the lower one downward by 14px
for (let i = 1; i < anchorVessels.length; i++) {
  const prev = anchorVessels[i-1];
  const curr = anchorVessels[i];
  if (Math.abs(prev.point.y - curr.point.y) < 14) {
    labelOffsets.set(curr.vessel.vessel_id, (labelOffsets.get(prev.vessel.vessel_id) ?? 0) + 14);
  }
}
```

### S4 — No visual indicator of optimised vessels in simulation

**Problem:** When the optimised plan is applied, users can't see which vessels were moved from one berth to another.

**Solution:** (Covered by S2) — use `optimization.moves` to add a distinctive visual treatment:
- Reassigned vessels get a glowing ring (info color)
- Add a "reassigned" badge next to the vessel label
- Optionally show a dashed arrow from the old berth to the new berth

### S5 — YardPanel is separate from simulation

**Problem:** Yard data appears in two places: the SVG yard blocks and the YardPanel below the simulation. They show different values (S1) and are disconnected.

**Solution:** After fixing S1 (using canonical yard data), also add a visual connection: clicking a yard block in the SVG highlights the corresponding row in YardPanel. Pass a `selectedYardBlock` state between them.

### S6 — No cross-tab interactivity (simulation ↔ Gantt)

**Problem:** Clicking a vessel in the simulation doesn't highlight it in the Gantt plan, and vice versa.

**Solution:** Lift `selectedVessel` state to the parent (`index.tsx`). Pass it to both PortSimulation and GanttPlan. When a vessel is selected in either component, the other highlights it. Use URL search params to persist the selection across tab switches.

### S7 — Simulation doesn't update when custom vessels are added

**Problem:** Custom vessels are merged on the backend, but the simulation only re-renders when the `vessels` prop changes. Since custom vessels are sent in the API call and returned in the response, this should work — but the React Query key includes `customVessels`, so it should invalidate. Verify that the query actually refetches when `customVessels` changes.

**Solution:** Already handled by the React Query key: `["port-state", JSON.stringify(events), JSON.stringify(customVessels), seed]`. When `customVessels` changes, the key changes, triggering a refetch. Verify this works by adding a console.log in the queryFn. If it's not working, the issue is that `customVessels` is a new array reference every render — use `useMemo` to stabilize it.

### S8 — BerthConfigPanel doesn't highlight affected berths in simulation

**Problem:** When a user closes B3 via BerthConfigPanel, the simulation doesn't visually highlight B3 as affected.

**Solution:** Pass the `events` array to PortSimulation. When a `berth_closure` or `crane_outage` event targets a berth, add a pulsing red border or hatch pattern on that berth in the SVG:
```tsx
const affectedBerths = events.filter(e => e.type === "berth_closure" || e.type === "crane_outage")
  .map(e => e.target);

// In berth rendering:
{affectedBerths.includes(berth.berth_id) && (
  <rect ... fill="var(--color-destructive)" fillOpacity={0.2}>
    <animate attributeName="fill-opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
  </rect>
)}
```

### S9 — No "today line" on simulation timeline

**Problem:** When scrubbing the timeline, there's no visual indicator of what's "now" vs future.

**Solution:** Add a vertical dashed line at the current simulation hour position:
```tsx
// After the vessel rendering, add a "now" indicator:
{hour > 0 && hour < HORIZON && (
  <line
    x1={QUAY_X - 30}
    y1={20}
    x2={QUAY_X - 30}
    y2={SCENE_H - 20}
    stroke="var(--color-primary)"
    strokeWidth={1.5}
    strokeDasharray="6 4"
    strokeOpacity={0.5}
  />
)}
```
Actually, the "now" line should be a horizontal line across the full scene at the current hour position. Since the scene is a 2D spatial view (not a time axis), the "now" concept is better conveyed through the timeline slider itself — the slider position IS the "now" line. Instead, add a "Now" label above the slider thumb.

### S10 — Departed vessels disappear instantly

**Problem:** When a vessel transitions from "departing" to "completed", it instantly vanishes from the scene.

**Solution:** Add a fade-out animation on vessels as they approach the scene boundary:
```tsx
// In the vessel rendering, add opacity based on distance from edge:
const opacity = item.point.x < -50 ? 0 : item.point.x < 0 ? (item.point.x + 50) / 50 : 1;
// Apply opacity to the vessel group
<g opacity={opacity}>...</g>
```

### S11 — Water wave animation is too subtle

**Problem:** The 12 wave paths animate but they're very faint (`strokeOpacity={0.07}`) and don't convey a busy port feel.

**Solution:** Increase wave visibility and add variety:
- Increase `strokeOpacity` to 0.12-0.15
- Add a second set of waves with different frequencies
- Add small animated dots (buoys) that bob up and down
- Add vessel wake trails behind moving vessels

### S12 — Live Activity log doesn't highlight phase changes

**Problem:** When a vessel changes phase (e.g., from "waiting" to "berthed"), the log doesn't scroll to show it or highlight the change.

**Solution:** Track phase changes with a `useEffect` and flash the changed row:
```tsx
const [lastPhaseChange, setLastPhaseChange] = useState<string | null>(null);
useEffect(() => {
  // Compare current placed phases with previous, set lastPhaseChange to the vessel ID
}, [placed]);
// In the log, apply a flash animation on the changed row
```

### S13 — Fleet Activity bar counts don't animate

**Problem:** The counts (15 Inbound, 0 Waiting, 2 Berthed, etc.) snap to new values without transition.

**Solution:** Add a brief scale animation when values change:
```tsx
// Use a key that changes when the count changes to trigger a CSS animation:
<span key={count} className="animate-pulse-once">{count}</span>
// With a CSS animation:
@keyframes pulse-once {
  0% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
.animate-pulse-once { animation: pulse-once 0.3s ease-out; }
```

---

## 4. Optimisation Tab

### O1 — OptimizationPanel shows "111 → 111" when nothing changes

**Problem:** When before and after values are the same (optimiser couldn't improve), the Delta component shows "111 → 111" which looks broken.

**Solution:** Detect when before === after and show a different display:
```tsx
function Delta({ before, after, unit = "" }) {
  if (before === after) {
    return (
      <span className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">{before}{unit}</span>
        <CheckCircle className="size-3.5 text-success" />
        <span className="text-success text-xs">Already optimal</span>
      </span>
    );
  }
  // ... existing arrow logic
}
```

### O2 — "Apply optimised plan" doesn't provide cross-tab visual confirmation

**Problem:** Clicking "Apply" changes the data, but there's no toast, banner, or visual indicator on other tabs.

**Solution:** Already handled by the existing toast system (`addToast("Optimised plan applied — plan updated", "success")`). But also add a persistent banner at the top of the page when `applied === true`:
```tsx
{applied && (
  <div className="bg-success/10 border-b border-success/30 px-4 py-2 text-sm text-success">
    Optimised plan active — all views reflect the optimised allocation.
    <button onClick={() => setApplied(false)} className="ml-2 underline">Revert</button>
  </div>
)}
```

### O3 — GanttPlan doesn't show reassignment indicators

**Problem:** All bars look the same — can't tell which vessels were reassigned by the optimiser.

**Solution:** Pass `optimization` to GanttPlan. For vessels in `optimization.moves`, add a distinctive border or pattern:
```tsx
const reassigned = new Set(optimization.moves.map(m => m.vessel_id));
// In bar rendering:
<span className={cn(
  "...",
  reassigned.has(entry.vessel_id) && "ring-2 ring-info ring-offset-1"
)}>
```

### O4 — Unresolved list is unreadable (100+ IDs)

**Problem:** `unresolved.join(", ")` creates a massive comma-separated string that's impossible to read.

**Solution:** Show as count with expandable detail:
```tsx
{unresolved.length > 0 && (
  <div>
    <p className="text-warning">
      {unresolved.length} vessel{unresolved.length > 1 ? "s" : ""} could not be improved
    </p>
    {unresolved.length <= 10 ? (
      <p className="text-xs text-muted-foreground">{unresolved.join(", ")}</p>
    ) : (
      <details>
        <summary className="text-xs text-muted-foreground cursor-pointer">
          Show {unresolved.length} vessel IDs
        </summary>
        <p className="text-xs text-muted-foreground mt-1">{unresolved.join(", ")}</p>
      </details>
    )}
  </div>
)}
```

### O5 — MacroRoutingPanel shows 244 advisories

**Problem:** 244 advisories is overwhelming. Judges can't process this volume.

**Solution:** Show top 15 most impactful advisories with a "Show all N" toggle:
```tsx
const [showAll, setShowAll] = useState(false);
const sorted = [...advice].sort((a, b) => {
  const priority = { divert_secondary_port: 0, slow_steaming: 1, offshore_holding: 2, advance_booking: 3 };
  return (priority[a.strategy] ?? 4) - (priority[b.strategy] ?? 4);
});
const visible = showAll ? sorted : sorted.slice(0, 15);
// Render visible, with "Show all 244" button if sorted.length > 15
```

### O6 — CraneRebalancePanel shows "~30% score reduction" for every move

**Problem:** Every crane rebalance move shows the same generic "~30% score reduction" text. The `congestion_reduction_estimate` is computed dynamically but may round to the same value.

**Solution:** Make the text specific to each move:
```tsx
// In crane-pool.ts, the congestion_reduction_estimate is already per-move:
congestion_reduction_estimate: Math.min(30, targetDelayed.length * 5 + cranesToMove * 8),
// This varies by move. The display should show the actual number:
<Pill variant="success">~{move.congestion_reduction_estimate}% score reduction</Pill>
// If all happen to be 30%, the formula needs tuning. Adjust the formula to produce more variance:
congestion_reduction_estimate: Math.min(25, Math.round(targetDelayed.length * 3.5 + cranesToMove * 6)),
```

### O7 — No total impact summary on optimisation tab

**Problem:** The tab shows individual moves but no aggregate "here's what the optimiser achieved" summary.

**Solution:** Add a prominent impact summary card at the top of the optimisation section:
```tsx
<div className="grid grid-cols-3 gap-4 mb-4">
  <div className="panel p-4 text-center">
    <p className="text-2xl font-bold text-success">{optimization.hours_saved_total}h</p>
    <p className="text-xs text-muted-foreground">Total waiting time saved</p>
  </div>
  <div className="panel p-4 text-center">
    <p className="text-2xl font-bold text-success">{optimization.fuel_saved_total_tons}t</p>
    <p className="text-xs text-muted-foreground">Fuel saved</p>
  </div>
  <div className="panel p-4 text-center">
    <p className="text-2xl font-bold text-success">{optimization.co2_saved_total_tons}t</p>
    <p className="text-xs text-muted-foreground">CO₂ emissions avoided</p>
  </div>
</div>
```

### O8 — GanttPlan has no styled tooltip

**Problem:** Bars have a `title` attribute for native browser tooltip, but it's plain text and slow to appear.

**Solution:** Replace with a styled tooltip using a state-driven popover:
```tsx
const [hoveredEntry, setHoveredEntry] = useState<ServiceEntry | null>(null);
// On bar hover:
onMouseEnter={() => setHoveredEntry(entry)}
onMouseLeave={() => setHoveredEntry(null)}
// Render a floating tooltip near the cursor:
{hoveredEntry && (
  <div className="absolute z-20 rounded-md border bg-popover p-2 text-xs shadow-lg" style={{ left: mouseX, top: mouseY }}>
    <p className="font-medium">{hoveredEntry.vessel_id}</p>
    <p>{hoveredEntry.type} · {hoveredEntry.service_hours}h service</p>
    <p>Wait: {hoveredEntry.wait_hours}h · {hoveredEntry.cranes_assigned} cranes</p>
  </div>
)}
```

### O9 — ForecastPanel "Why?" is static text

**Problem:** The explanation for why a window is rated a certain way is plain text bullets. No interactivity.

**Solution:** Make the factors clickable — clicking a factor highlights the relevant data in the forecast chart:
- "11 vessels queueing" → highlight the arrivals bar at that hour
- "B3 at 100% utilisation" → flash B3 in the Gantt chart
This requires cross-component communication via lifted state.

### O10 — No side-by-side before/after comparison

**Problem:** User has to remember what changed after applying the optimised plan.

**Solution:** Add a before/after summary bar at the top of the OptimizationPanel:
```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="rounded-md border border-border p-3">
    <h4 className="text-xs font-medium text-muted-foreground mb-2">Before Optimisation</h4>
    <div className="space-y-1 text-xs">
      <div>Conflicts: {before.hotspots.length}</div>
      <div>Score: {before.port_score}</div>
      <div>Avg wait: {metrics_before.avg_wait_hours}h</div>
    </div>
  </div>
  <div className="rounded-md border border-success/30 p-3">
    <h4 className="text-xs font-medium text-success mb-2">After Optimisation</h4>
    <div className="space-y-1 text-xs">
      <div>Conflicts: {after.hotspots.length}</div>
      <div>Score: {after.port_score}</div>
      <div>Avg wait: {metrics_after.avg_wait_hours}h</div>
    </div>
  </div>
</div>
```

### O11 — MacroRoutingPanel fuel units inconsistency

**Problem:** `MacroRoutingAdvice` uses `fuel_savings_kg` while `RoutingStrategy` uses `fuel_saved_tons`. Different panels show different units.

**Solution:** Standardise on one unit. Since `fuel_savings_kg` is used in the UI panel, convert all values to kg in the backend:
```tsx
// In routing.ts, convert tons to kg:
fuel_savings_kg: Math.round(fuel_saved_tons * 1000),
```
Or display with unit conversion in the panel:
```tsx
{item.fuel_savings_kg !== null && (
  <span>{item.fuel_savings_kg >= 1000 ? `${(item.fuel_savings_kg/1000).toFixed(1)}t` : `${item.fuel_savings_kg}kg`}</span>
)}
```

### O12 — CraneRebalancePanel lacks practical impact

**Problem:** Shows "1 crane B2 → B3 ~30% score reduction" but doesn't explain what this means operationally.

**Solution:** Enhance the reason text to include practical impact:
```tsx
// In crane-pool.ts, add a practical_impact field:
practical_impact: `This reduces B3's average vessel wait by approximately ${Math.round(targetDelayed.length * 1.5)} hours.`,
```

### O13 — No undo for preset scenarios

**Problem:** Once a preset scenario is applied, the only way to undo is to manually remove each event or click "Reset port".

**Solution:** Add a "Undo last scenario" button that removes the most recently added events:
```tsx
const [eventHistory, setEventHistory] = useState<ScenarioEvent[][]>([]);

const applyPreset = (newEvents: ScenarioEvent[]) => {
  setEventHistory(prev => [...prev, events]); // save current state
  setEvents(newEvents);
};

const undoLastScenario = () => {
  const prev = eventHistory[eventHistory.length - 1];
  if (prev) {
    setEvents(prev);
    setEventHistory(h => h.slice(0, -1));
  }
};
```

### O14 — ForecastPanel "observed" line doesn't update

**Problem:** The "observed" line only shows data for hours 0-12. When the simulation advances past hour 12, the observed line doesn't extend.

**Solution:** Make the observed line endpoint dynamic based on the simulation's current hour:
```tsx
// In prediction.ts, change:
current: hour <= 12 ? score : null,
// To accept an optional currentHour parameter:
current: hour <= currentHour ? score : null,
```
Pass the simulation's current hour from the parent component.

---

## 5. AI Copilot Tab

### C1 — No conversation history persistence

**Problem:** Refreshing the page loses all chat history. The `turns` state is local to CopilotChat.

**Solution:** Persist conversation in `sessionStorage`:
```tsx
const [turns, setTurns] = useState<Turn[]>(() => {
  const saved = sessionStorage.getItem("copilot-turns");
  return saved ? JSON.parse(saved) : [];
});

useEffect(() => {
  sessionStorage.setItem("copilot-turns", JSON.stringify(turns));
}, [turns]);
```
Add a "Clear chat" button to reset history.

### C2 — Suggestions disappear after first question

**Problem:** The suggestion chips only render when `turns.length === 0`. After asking one question, they vanish permanently.

**Solution:** Always show suggestions below the chat, not just when empty:
```tsx
{/* Always show suggestions at the bottom of the chat area */}
<div className="flex flex-wrap gap-2 mt-3">
  {SUGGESTIONS.map(s => (
    <button key={s} onClick={() => ask(s)} className="...">
      {s}
    </button>
  ))}
</div>
```

### C3 — No loading indicator per-turn

**Problem:** During streaming, only "Checking port state..." text is shown. No visual indication that the AI is thinking.

**Solution:** Add a pulsing dots animation during streaming:
```tsx
{t.text ? (
  <SimpleMarkdown text={t.text} />
) : (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <div className="flex gap-1">
      <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{animationDelay: '0ms'}} />
      <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{animationDelay: '150ms'}} />
      <span className="size-1.5 rounded-full bg-primary animate-bounce" style={{animationDelay: '300ms'}} />
    </div>
    Thinking...
  </div>
)}
```

### C4 — No feedback mechanism on AI responses

**Problem:** No way to mark responses as helpful/unhelpful for quality tracking.

**Solution:** Add thumbs up/down buttons after each AI response:
```tsx
<div className="flex gap-2 mt-2">
  <button onClick={() => logFeedback(i, "up")} className="text-muted-foreground hover:text-success">
    <ThumbsUp className="size-3" />
  </button>
  <button onClick={() => logFeedback(i, "down")} className="text-muted-foreground hover:text-destructive">
    <ThumbsDown className="size-3" />
  </button>
</div>
```
Log feedback to console or localStorage for demo purposes.

### C5 — CopilotChat doesn't know if optimisation was applied

**Problem:** Sends `events` and `customVessels` but not `applied` state. The AI can't contextualise answers like "after applying the optimised plan, B3 improved."

**Solution:** Send the full context to the copilot API:
```tsx
body: JSON.stringify({
  question: text,
  events,
  applied, // NEW: whether optimised plan is active
  custom_vessels: customVessels.map(...),
  optimization_summary: applied ? {
    hours_saved: optimization.hours_saved_total,
    moves_count: optimization.moves.length,
  } : null,
}),
```

### C6 — No error retry when Ollama is down

**Problem:** If Ollama fails, user gets an error message but no way to retry.

**Solution:** Add a retry button on error messages:
```tsx
{turn.text.includes("failed") || turn.text.includes("problem") ? (
  <div>
    <p className="text-destructive">{turn.text}</p>
    <button onClick={() => {
      // Remove the error turn and re-ask the previous question
      const lastUserTurn = turns.filter(t => t.role === "user").pop();
      if (lastUserTurn) {
        setTurns(t => t.slice(0, -2)); // remove error + empty assistant
        ask(lastUserTurn.text);
      }
    }} className="text-xs text-primary underline">
      Retry
    </button>
  </div>
) : (
  <SimpleMarkdown text={turn.text} />
)}
```

### C7 — PresetScenarios duplicated between Copilot and ScenarioPanel

**Problem:** Preset scenarios exist as a concept in both the Copilot tab (PresetScenarios component) and the Optimisation tab (ScenarioPanel's quick buttons). This is confusing.

**Solution:** Move PresetScenarios to a single location — the ScenarioPanel. On the Copilot tab, show a link "Apply a preset scenario →" that navigates to the Optimisation tab's ScenarioPanel. Remove the duplicate PresetScenarios component from the Copilot tab.

### C8 — "Reset port" clears custom vessels unexpectedly

**Problem:** Clicking "Reset port" in ScenarioPanel calls `setEvents([])` which clears disruption events, but also calls `setCustomVessels([])` through the parent's `onReset`. Users who added custom vessels lose them.

**Solution:** Make reset only clear disruption events, not custom vessels:
```tsx
onReset={() => {
  setApplied(false);
  setEvents([]);
  // Do NOT clear customVessels
  addToast("Disruption events cleared", "info");
}}
```
Add a separate "Clear all data" button that resets everything including custom vessels.

### C9 — ScenarioPanel doesn't show impact preview before applying

**Problem:** User clicks "Apply event" blind — they don't know how it will affect congestion until after.

**Solution:** Show a preview calculation before applying:
```tsx
// When user changes event type/target/duration, compute a quick preview:
const previewImpact = useMemo(() => {
  // Quick heuristic: estimate score change based on event type
  if (type === "berth_closure") return { scoreDelta: +15, vesselsAffected: "~8-12" };
  if (type === "crane_outage") return { scoreDelta: +10, vesselsAffected: "~5-8" };
  if (type === "vessel_surge") return { scoreDelta: +20, vesselsAffected: magnitude };
  if (type === "severe_weather") return { scoreDelta: +25, vesselsAffected: "All" };
  return null;
}, [type, magnitude]);

// Show preview below the form:
{previewImpact && (
  <div className="text-xs text-warning mt-2">
    Estimated impact: +{previewImpact.scoreDelta} congestion score, ~{previewImpact.vesselsAffected} vessels affected
  </div>
)}
```

### C10 — No indication that AI is local (Ollama)

**Problem:** Judges might think the AI is cloud-based. No transparency about it being local.

**Solution:** Add a small badge near the chat header:
```tsx
<div className="flex items-center gap-2">
  <h2>AI Operations Copilot</h2>
  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">
    Powered by Ollama (local)
  </span>
</div>
```

### C11 — Suggestion chips are generic, not contextual

**Problem:** Always shows the same 4 suggestions regardless of port state.

**Solution:** Generate contextual suggestions based on current data:
```tsx
const suggestions = useMemo(() => {
  const base = [];
  // Find the most congested berth
  const worstBerth = data.congestion.berths.sort((a,b) => b.score - a.score)[0];
  if (worstBerth) base.push(`Why is ${worstBerth.berth_id} the most congested berth?`);
  // Find the most delayed vessel
  const worstVessel = data.vessels.sort((a,b) => b.wait_time_hours - a.wait_time_hours)[0];
  if (worstVessel && worstVessel.wait_time_hours > 10) {
    base.push(`Why is ${worstVessel.vessel_id} waiting ${worstVessel.wait_time_hours}h?`);
  }
  // If events are active
  if (events.length > 0) base.push("Summarise the impact of the active disruption.");
  // Fill remaining with defaults
  while (base.length < 4) base.push(SUGGESTIONS[base.length]);
  return base;
}, [data, events]);
```

### C12 — No "copy" button on AI responses

**Problem:** Users can't easily copy AI responses for sharing or presenting.

**Solution:** Add a copy button on each AI response:
```tsx
<button
  onClick={() => navigator.clipboard.writeText(turn.text)}
  className="text-muted-foreground hover:text-foreground"
>
  <Copy className="size-3" />
</button>
```

---

## 6. Reports Tab

### R1 — Tab is called "Reports" but contains no reports

**Problem:** The tab name "Reports" implies output documents. The actual content is input controls (add vessel, CSV import, berth config) and a plan generator.

**Solution:** Rename the tab from "Reports" to "Controls" or "Inputs & Plan":
```tsx
// In index.tsx TABS array:
{ id: "reports", label: "Controls", icon: <Settings className="size-4" /> },
```

### R2 — VesselEntryForm shows no feedback after adding

**Problem:** After clicking "Add vessel", the form silently resets. No confirmation that it worked.

**Solution:** Show a success message and briefly highlight the added vessel:
```tsx
const [lastAdded, setLastAdded] = useState<string | null>(null);

const handleSubmit = (e) => {
  // ... validation
  onAdd({ ...form, vessel_id: id });
  setLastAdded(id);
  setTimeout(() => setLastAdded(null), 3000);
  setForm({ vessel_id: "", type: "Container", cargo: "", eta_hours: 24, priority: "standard" });
};

{lastAdded && (
  <p className="text-xs text-success">
    ✓ Added {lastAdded} to port — it will appear in the next data refresh
  </p>
)}
```

### R3 — CSVImportPanel doesn't validate CSV structure

**Problem:** Silently ignores bad rows. User doesn't know if their CSV was parsed correctly.

**Solution:** Show validation warnings during preview:
```tsx
const warnings: string[] = [];
vessels.forEach((v, i) => {
  if (!v.vessel_id || v.vessel_id.startsWith("V100")) warnings.push(`Row ${i+1}: Missing or default vessel ID`);
  if (v.eta_hours < -12 || v.eta_hours > 168) warnings.push(`Row ${i+1}: ETA ${v.eta_hours}h is outside range`);
});

{warnings.length > 0 && (
  <div className="text-xs text-warning mt-2">
    <p>{warnings.length} warning(s):</p>
    <ul>{warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}</ul>
  </div>
)}
```

### R4 — BerthConfigPanel applies changes but no visual confirmation elsewhere

**Problem:** Clicking "Apply" on a berth config generates events, but the user doesn't see immediate visual feedback on other tabs.

**Solution:** After applying, show a toast AND briefly flash the berth's row in the AllocationTable (if visible) by passing the affected berth ID to the parent state.

### R5 — CustomScenarioBuilder target is free-text

**Problem:** User can type "B7" or "xyz" as a target. No validation against actual berth/vessel IDs.

**Solution:** Replace the free-text input with a dropdown that lists valid targets:
```tsx
// For berth-related events, show berth dropdown:
{event.type === "berth_closure" || event.type === "crane_outage" ? (
  <select value={event.target} onChange={...}>
    {berths.map(b => <option key={b.berth_id} value={b.berth_id}>{b.berth_id}</option>)}
  </select>
) : event.type === "vessel_delay" ? (
  <select value={event.target} onChange={...}>
    {vessels.map(v => <option key={v.vessel_id} value={v.vessel_id}>{v.vessel_id}</option>)}
  </select>
) : (
  <input value="PORT" disabled /> // PORT for port-wide events
)}
```

### R6 — PlanPanel says "Close a berth first"

**Problem:** The placeholder text "No plan generated yet. Close a berth first to see the optimiser react" is misleading. The plan works without disruptions.

**Solution:** Change the copy:
```tsx
<p className="text-sm text-muted-foreground">
  Generate a 72-hour operational plan from the current port state, including vessel reassignments, congestion hotspots, and recommended actions.
</p>
```

### R7 — PlanPanel doesn't auto-scroll during streaming

**Problem:** As the AI streams text, the container doesn't scroll to show new content.

**Solution:** Add auto-scroll to the plan container:
```tsx
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (containerRef.current && loading) {
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }
}, [plan, loading]);

<div ref={containerRef} className="max-h-96 min-h-24 overflow-auto ...">
  {plan && <SimpleMarkdown text={plan} />}
</div>
```

### R8 — BerthConfigPanel duration doesn't validate against window

**Problem:** Duration allows 1-72h but doesn't check if the closure would extend beyond the 72-hour planning window.

**Solution:** Add validation:
```tsx
if (duration_hours > 72) {
  setError("Duration cannot exceed the 72-hour planning window");
  return;
}
```

### R9 — CSVImportPanel shows only 5 rows in preview

**Problem:** Can't verify the full import before committing.

**Solution:** Show all rows but with a scrollable container:
```tsx
<div className="max-h-48 overflow-auto rounded-md border border-border">
  <table className="w-full text-xs">
    {/* Show ALL rows, not just preview.slice(0, 5) */}
    {preview.map((v, i) => (
      <tr key={i}>...</tr>
    ))}
  </table>
</div>
{preview.length > 10 && (
  <p className="text-xs text-muted-foreground">Showing all {preview.length} vessels</p>
)}
```

### R10 — No export for generated plan

**Problem:** The AI-generated 72-hour plan is displayed as markdown but can't be downloaded.

**Solution:** Add copy and download buttons:
```tsx
<div className="flex gap-2 mb-2">
  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(plan)}>
    <Copy className="size-3" /> Copy
  </Button>
  <Button size="sm" variant="outline" onClick={() => {
    const blob = new Blob([plan], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `port-plan-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
  }}>
    <Download className="size-3" /> Download
  </Button>
</div>
```

### R11 — VesselEntryForm doesn't auto-suggest next vessel ID

**Problem:** User has to guess what ID to use. Could accidentally duplicate existing IDs.

**Solution:** Auto-suggest the next available ID:
```tsx
const nextId = useMemo(() => {
  const existingNums = existingIds
    .filter(id => id.startsWith("V"))
    .map(id => parseInt(id.slice(1)))
    .filter(n => !isNaN(n));
  const max = Math.max(0, ...existingNums);
  return `V${max + 1}`;
}, [existingIds]);

// Set as default value:
const [form, setForm] = useState({
  vessel_id: nextId,
  ...
});
```

### R12 — CustomScenarioBuilder magnitude field shows for all types

**Problem:** The magnitude field is visible for all event types but only applies to `crane_outage` (cranes down) and `vessel_surge` (extra vessels). For `berth_closure` and `severe_weather` it's meaningless.

**Solution:** Only show magnitude field when relevant:
```tsx
{event.type === "crane_outage" || event.type === "vessel_surge" ? (
  <div className="w-20">
    <label>Magnitude</label>
    <input type="number" ... />
  </div>
) : event.type === "vessel_delay" ? (
  <div className="w-20">
    <label>Delay (h)</label>
    <input type="number" ... />
  </div>
) : null}
```

---

## 7. Cross-Cutting / System-Wide

### X1 — Applied state only lives in frontend

**Problem:** Refreshing the page loses the "optimised plan applied" state. The `applied` boolean is in `useState` which resets on unmount.

**Solution:** Persist in `sessionStorage` or URL search params:
```tsx
const [applied, setApplied] = useState(() => {
  return sessionStorage.getItem("port-applied") === "true";
});

useEffect(() => {
  sessionStorage.setItem("port-applied", String(applied));
}, [applied]);
```

### X2 — No shared state context

**Problem:** `events`, `customVessels`, `applied`, `seed`, `selectedVessel` are all independent `useState` calls in `index.tsx`. Cross-tab communication requires prop drilling. Adding new shared state requires modifying the parent and every child.

**Solution:** Create a `PortContext` that holds all shared state:
```tsx
// port-context.tsx
interface PortState {
  events: ScenarioEvent[];
  customVessels: Vessel[];
  applied: boolean;
  seed: number | null;
  selectedVessel: string | null;
  selectedTab: string;
  // Actions
  addEvent: (event: ScenarioEvent) => void;
  removeEvent: (id: string) => void;
  setApplied: (v: boolean) => void;
  // ... etc
}

const PortContext = createContext<PortState | null>(null);

export function PortProvider({ children }) {
  // All useState/useCallback logic moves here
  return <PortContext.Provider value={state}>{children}</PortContext.Provider>;
}

export function usePortState() {
  const ctx = useContext(PortContext);
  if (!ctx) throw new Error("usePortState must be used within PortProvider");
  return ctx;
}
```

Then any component can call `usePortState()` instead of receiving props. This eliminates prop drilling and makes cross-tab sync trivial.

### X3 — Backend generates data twice per request

**Problem:** `buildPortState()` calls `generatePortData()` twice — once for baseline, once for current. Same seed = same data. Wasteful.

**Solution:** Generate once and clone for baseline:
```tsx
const portData = generatePortData(input.seed);
const baselineData = { ...portData, vessels: portData.vessels.map(v => ({...v})) };
const currentData = { ...portData, vessels: portData.vessels.map(v => ({...v})) };
```
Or generate once and use spread copies for the scenario-modified version.

### X4 — No loading skeletons

**Problem:** When switching tabs or applying scenarios, content jumps from a spinner to full content.

**Solution:** Create reusable skeleton components:
```tsx
function SkeletonCard() {
  return <div className="panel h-32 animate-pulse bg-surface/60 rounded-lg" />;
}

function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse bg-surface/60 rounded" />
      ))}
    </div>
  );
}
```
Use these in each tab's loading state instead of the generic spinner.

### X5 — No responsive design for mobile

**Problem:** Tables overflow horizontally, simulation SVG is too small on mobile, tab navigation is cramped.

**Solution:** 
- Add `overflow-x-auto` on all table containers (already exists on some)
- On mobile, stack the side-by-side grids (Dashboard uses `xl:grid-cols-2`, which already stacks)
- For the simulation, add a "zoom" control or make the SVG horizontally scrollable
- Use a hamburger menu for tabs on mobile instead of horizontal scrolling tabs

### X6 — No keyboard navigation

**Problem:** Can't tab through vessel rows, berth controls, or interactive SVG elements.

**Solution:** Add `tabIndex={0}` and `onKeyDown` handlers to interactive elements. For the vessel table, add arrow key navigation:
```tsx
<tr
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter") onSelect(vessel.vessel_id);
    if (e.key === "ArrowDown") e.currentTarget.nextElementSibling?.focus();
  }}
>
```
For SVG elements, already has `tabIndex={0}` and `onKeyDown` on vessel glyphs — verify this works.

### X7 — Missing ARIA labels

**Problem:** Many buttons and interactive elements lack ARIA labels for screen readers.

**Solution:** Add `aria-label` to all icon-only buttons:
```tsx
<button aria-label="Close disruption" onClick={...}>
  <Trash2 className="size-3.5" />
</button>

<button aria-label="Play simulation" onClick={...}>
  <Play className="size-4" />
</button>
```
Add `role` attributes to interactive SVG groups.

### X8 — No app-level error boundary

**Problem:** A crash in one tab (e.g., bad data in Gantt) kills the entire UI.

**Solution:** Wrap the tab content area in an ErrorBoundary:
```tsx
// In index.tsx renderTabContent():
<ErrorBoundary key={activeTab}>
  {renderTabContent()}
</ErrorBoundary>
```
This already exists for individual components but not for the entire tab content area.

### X9 — Toast auto-dismiss is too fast

**Problem:** 4-second auto-dismiss might miss important notifications during demos.

**Solution:** Make dismiss time configurable per toast type:
```tsx
interface Toast {
  id: string;
  message: string;
  type: "success" | "info" | "warning";
  duration?: number; // default 4000
}

// Usage:
addToast("Optimised plan applied", "success", 8000); // longer for important ones
addToast("Event removed", "info"); // default 4000
```

### X10 — No undo/redo

**Problem:** No way to undo applying a scenario, adding a vessel, or importing CSV.

**Solution:** Implement a command history stack:
```tsx
const [history, setHistory] = useState<{ events: ScenarioEvent[]; customVessels: Vessel[] }[]>([]);
const [future, setFuture] = useState<typeof history>([]);

const pushState = () => {
  setHistory(h => [...h.slice(-10), { events, customVessels }]); // keep last 10
  setFuture([]);
};

const undo = () => {
  const prev = history[history.length - 1];
  if (prev) {
    setFuture(f => [...f, { events, customVessels }]);
    setEvents(prev.events);
    setCustomVessels(prev.customVessels);
    setHistory(h => h.slice(0, -1));
  }
};
```

### X11 — Demo Tour doesn't highlight UI elements

**Problem:** Shows text descriptions but doesn't visually point to the relevant UI elements.

**Solution:** Add highlight overlays on each step:
```tsx
// In DemoTour, for each step, render a translucent overlay that highlights the target element:
{current.highlight && (
  <div className="fixed inset-0 z-40 pointer-events-none">
    <div className="absolute inset-0 bg-black/50" />
    <div
      className="absolute bg-transparent border-2 border-primary rounded-lg"
      style={getHighlightBounds(current.highlight)}
    />
  </div>
)}
```
Use `getBoundingClientRect()` on the target element to position the highlight.

### X12 — No "share state" feature

**Problem:** Can't send a specific scenario configuration to a judge via URL.

**Solution:** Encode state in URL search params:
```tsx
const stateToUrl = () => {
  const params = new URLSearchParams();
  if (events.length) params.set("events", JSON.stringify(events));
  if (applied) params.set("applied", "true");
  if (customVessels.length) params.set("vessels", JSON.stringify(customVessels));
  return `${window.location.pathname}?${params.toString()}`;
};

const urlToState = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has("events")) setEvents(JSON.parse(params.get("events")!));
  if (params.has("applied")) setApplied(true);
  // ... etc
};
```

### X13 — No rate limiting on backend

**Problem:** API can be hammered with rapid requests.

**Solution:** Add simple rate limiting middleware:
```ts
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests, please try again later.",
});

app.use("/api/", limiter);
```

### X14 — No health check endpoint

**Problem:** No way to verify the backend is running or that Ollama is connected.

**Solution:** Add a health check endpoint:
```ts
// In server.ts or routes/health.ts
app.get("/api/health", async (req, res) => {
  let ollamaOk = false;
  try {
    const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    ollamaOk = r.ok;
  } catch {}
  res.json({ status: "ok", ollama: ollamaOk, timestamp: new Date().toISOString() });
});
```

### X15 — No ESLint config

**Problem:** TypeScript strict mode is on but no ESLint for catching common mistakes (unused vars, console.logs, etc.).

**Solution:** Add ESLint config:
```json
// .eslintrc.json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```
Add `npm run lint` script and run it in CI.

---

## 8. Priority Implementation Order

### Phase 1 — Critical Data & Architecture (do first)

| Order | ID | Problem | Why First |
|-------|-----|---------|-----------|
| 1 | X2 | Shared state context (PortContext) | Everything else depends on this |
| 2 | S1 | Yard % inconsistency | Data trust — judges will notice |
| 3 | X3 | Backend generates data twice | Performance, easy fix |
| 4 | X1 | Persist applied state | State loss on refresh |

### Phase 2 — UX Overhaul (highest judge impact)

| Order | ID | Problem | Why |
|-------|-----|---------|-----|
| 5 | D1 | VesselTable search/filter | #1 most-used component |
| 6 | O1 | "111 → 111" confusion | Looks broken |
| 7 | O4 | Unresolved list unreadable | Looks broken |
| 8 | O5 | 244 advisories overwhelm | Too much info |
| 9 | D9 | VesselTable summary counts | Quick overview |
| 10 | D2 | KPI trend arrows | Dynamic feel |

### Phase 3 — Cross-Tab Sync & Visual Feedback

| Order | ID | Problem | Why |
|-------|-----|---------|-----|
| 11 | D4 | AllocationTable current vessel | Data completeness |
| 12 | S2/S4 | Simulation optimization indicators | Cross-tab sync |
| 13 | O3 | Gantt reassignment indicators | Visual feedback |
| 14 | O7 | Total impact summary card | Storytelling |
| 15 | C5 | Copilot knows applied state | Data completeness |

### Phase 4 — Polish & Production Readiness

| Order | ID | Problem | Why |
|-------|-----|---------|-----|
| 16 | R5 | Free-text target validation | Input validation |
| 17 | R6 | PlanPanel misleading copy | UX fix |
| 18 | C8 | Reset clears custom vessels | UX surprise |
| 19 | X4 | Skeleton loaders | Polish |
| 20 | D13 | Routing strategy in detail sheet | Data completeness |

### Phase 5 — Low Priority Nice-to-Haves

| Order | ID | Problem | Why |
|-------|-----|---------|-----|
| 21 | L4 | Favicon | Branding |
| 22 | L3 | Dynamic landing stats | Accuracy |
| 23 | C1 | Chat history persistence | UX |
| 24 | C10 | Ollama badge | Transparency |
| 25 | X12 | Share state via URL | Demo tool |
| 26 | X14 | Health check endpoint | Production |
| 27 | X15 | ESLint config | Code quality |
| 28-60 | All remaining | See full lists above | Various |

---

*This document covers all 60+ identified issues across the entire PortPredict AI system. Each problem includes the specific files involved and a code-level solution that integrates with the existing architecture rather than working around it.*
