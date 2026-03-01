# Frontend / Operator Thread Prompts

These prompts are for the next System 4 push: turning the existing React/Vite frontend into a benchmark and operator surface.

Each thread should read first:

- `AGENTS.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/mvp-scope.md`
- `docs/agent-loop.md`
- `docs/tournament-mode.md`
- `docs/agent-tools.md`

Also inspect the current frontend shape before changing it:

- `frontend/src/App.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Marketplace.tsx`
- `frontend/src/pages/ShopDetail.tsx`
- `frontend/src/pages/ListingDetail.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/types/api.ts`

## Thread 1: Run Explorer

```text
Build a run explorer UI on top of Botique's persisted artifact bundles and runtime result data.

Scope:
- Work primarily in `frontend/src/`
- Add a run explorer route and supporting components
- The run explorer should let an operator inspect a single run day by day
- Show the information that makes agent behavior legible:
  - morning briefing
  - work-slot actions
  - action arguments
  - tool results
  - workspace text
  - recent workspace-history entries
  - end-of-day workspace-history entry
  - cash / listing / sales / backlog / production deltas when available
- Make it feel like an observatory / trace viewer, not a generic CRUD admin page

Requirements:
- Reuse the existing frontend visual language where sensible, but push it toward a clearer benchmark/operator identity
- Avoid fake data; wire it to real artifact/result contracts
- Prefer progressive disclosure: summary first, day drill-down second, raw JSON only as a final fallback
- Do not invent hidden metrics that are not present in artifacts

Likely files:
- `frontend/src/App.tsx`
- new route/page under `frontend/src/pages/`
- new components under `frontend/src/components/`
- `frontend/src/api/client.ts`
- `frontend/src/types/api.ts`

Deliverables:
- code
- any necessary lightweight API/client support
- a concise note on the artifact/result contract assumed by the UI

Goal:
Make a single run inspectable enough that a human can understand what the agent saw, did, and how the world changed.
```

## Thread 2: Benchmark Dashboard

```text
Build a benchmark/comparison dashboard for Botique runs.

Scope:
- Work primarily in `frontend/src/`
- Add a comparison-focused view that can show multiple runs or models side by side
- Focus on benchmark readability:
  - run metadata
  - model / provider / settings
  - scenario / seed labels if available
  - headline score
  - supporting diagnostics
  - quick links into the full run explorer
- Use cards, tables, and charts where helpful, but keep the page opinionated and scan-friendly

Requirements:
- The dashboard should feel like a benchmark console, not an e-commerce storefront
- Avoid over-indexing on one score; show supporting signals that explain outcomes
- Make room for tournament results to plug into the same visual language later
- Keep the data model close to current run summaries and artifacts

Likely files:
- `frontend/src/App.tsx`
- new route/page under `frontend/src/pages/`
- new components under `frontend/src/components/`
- `frontend/src/api/client.ts`
- `frontend/src/types/api.ts`

Deliverables:
- code
- any necessary lightweight client/type changes
- a concise note on how the comparison surface maps to current runtime outputs

Goal:
Make model-vs-model or run-vs-run comparison feel like a real benchmark product.
```

## Thread 3: Tournament Mode UI

```text
Build a frontend surface for Botique tournament mode.

Scope:
- Work primarily in `frontend/src/`
- Add a tournament view that can present:
  - entrants
  - rounds
  - rotating shop assignments
  - standings / scorecards
  - per-round drilldown or replay entry points
- Keep the isolated single-run baseline visible in the product, but make tournament mode feel like a first-class additive mode

Requirements:
- Read `docs/tournament-mode.md` carefully and stay faithful to the implemented fairness model
- Make standings easy to read at a glance
- Make it easy to move from tournament summary -> entrant -> round -> underlying run detail
- Do not assume a radically different backend than the runtime already has

Likely files:
- `frontend/src/App.tsx`
- new route/page under `frontend/src/pages/`
- new components under `frontend/src/components/`
- `frontend/src/api/client.ts`
- `frontend/src/types/api.ts`

Deliverables:
- code
- any required lightweight client/type additions
- a concise note on the tournament result shape expected by the UI

Goal:
Turn tournament mode into something demoable and understandable without reading logs in a terminal.
```

## Thread 4: Operator Controls

```text
Add operator controls for launching and resetting Botique runs from the frontend.

Scope:
- Work primarily in `frontend/src/`
- Add a control surface for:
  - world reset
  - single-run launch
  - tournament launch
  - model selection
  - day/turn configuration where appropriate
- Keep it clearly separated from seller-facing UI
- The operator should be able to start a run and then immediately navigate to the resulting artifact/run view

Requirements:
- Use the control surface cleanly; do not blur seller-facing APIs with operator commands
- Make the UX feel intentional and safe
- Prefer a compact “mission control” panel over scattered buttons
- Keep it hackathon-pragmatic; it does not need enterprise permissions or workflow complexity

Likely files:
- `frontend/src/pages/Dashboard.tsx`
- new operator-focused components under `frontend/src/components/`
- `frontend/src/api/client.ts`
- `frontend/src/types/api.ts`

Deliverables:
- code
- any necessary control-client additions
- a concise note on how operator actions map to the existing control API

Goal:
Let a human operator drive Botique runs and demos without dropping to the terminal.
```
