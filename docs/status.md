# Botique Status

Last updated: `2026-03-01`

## Purpose

This file is the lightweight build-status view for the project.

Use it to answer four questions quickly:

- what already works end to end
- what is actively being deepened now
- what likely comes next
- which important decisions are still open

This doc should stay short and operational. Detailed reasoning belongs in the topic docs.

## Current

These pieces already exist in the repo and are safe to build on.

- System 1 seller-facing API service in `server/`
- separate `/control` surface for simulation/runtime inspection and day advancement
- seeded digital-first marketplace state with shops, listings, orders, reviews, payments, and taxonomy
- System 2 simulation `v1` with current day, trend state, market snapshot, search context, pending-event hooks, and consequence-producing `advanceDay`
- inspectable day resolution for active listings with formula-driven views, favorites, orders, delayed payment posting, and delayed review creation
- transparent marketplace ranking based on relevance, listing quality, reviews, price fit, recency, and trend bonus
- Python `seller_core` client/CLI for the portable seller-facing tool surface
- Python single-shop agent runtime with live morning briefing generation
- one-tool-per-turn agent loop with bounded inspection, a forced act-or-`no_action` decision, and automatic day settlement
- phase-aware prompt/tool exposure that summarizes prior tool results in-model while keeping full raw payloads in artifacts
- unified owner-agent workspace memory with mutable current workspace text, append-only workspace-history entries, and reminders
- Mistral provider wiring for tool-calling runs
- multi-day runtime path that can build briefings from live Botique state, advance the simulation between days, and persist artifact-rich reference-run bundles for inspection
- additive arena-style tournament orchestration with rotating entrant order, rotating shop assignments, and shared-world round resets through the control API

## In Motion

These are the current product and architecture priorities.

- get to a first believable reference run as quickly as possible
- redesign the agent loop so it behaves like a seller workflow instead of an open-ended search loop
- pivot the intended product scope from digital-first toward creative-goods businesses with production constraints
- tune the new System 2 consequence pipeline so the world feels believable across multiple days
- preserve the clean boundary between seller-facing tools and control/runtime surfaces
- keep the Etsy-compatible `seller_core` story honest without letting portability concerns slow the core demo
- use the new reference-run bundle as the baseline artifact for loop and simulation tuning

## Next

Near-term work that should most improve the first end-to-end run.

- tune `agent-loop v1` against live traces so the inspect/act contract feels natural across scenarios
- decide the first production/capacity abstraction and which shop archetypes belong in the seeded world
- migrate the seed taxonomy and marketplace examples away from digital-first products if the scope pivot holds
- improve the morning briefing so it highlights opportunities, risks, and strongest/weakest listing signals
- tune how the unified workspace and reminders support the v1 runtime without becoming the main action
- tune the first consequence-producing day pipeline against multi-day traces
- decide whether the next demand step should be explicit cohort sessions or a richer aggregate demand model
- add delayed customer-message delivery on top of the existing pending-event queue if it materially improves the demo
- review and tune against the first persisted reference-run bundle instead of ad hoc terminal output

## Later

Likely expansions once the first believable run is working.

- persistent customer identities or cohort drift beyond the initial static cohort set
- scripted competitor archetypes with distinct marketplace strategies
- richer operator/debug traces explaining why listings did or did not perform
- stronger evaluation metrics and scenario seeds
- frontend/operator dashboard polish
- optional deeper portability work around real Etsy-compatible integration

## Open Questions

- what the primary business score should be for evaluation
- how explicit production should be in the first build: stock only, backlog only, or both
- whether hackathon scope needs persistent repeat customers beyond cohort-level repeat affinity
- when to add stronger inter-shop competition
- when, if ever during the hackathon, optional LLM-written review or message text should be added on top of structured outcomes
- how much demo value there is in the Etsy-hookup story relative to core Botique simulation quality

## Updating Rule

When the project state changes, update this file first if the answer to any of these changes:

- what works now
- what is actively being built now
- what is clearly next
- what remains unresolved
