# Botique Status

Last updated: `2026-03-01`

## Purpose

This file is the lightweight build-status view for the project.

Use it to answer four questions quickly:

- what already works end to end
- what the team is actively pushing now
- what clearly comes next
- which important decisions are still open

This doc should stay short and operational. Detailed reasoning belongs in the topic docs.

## Current

These pieces already exist in the repo and are safe to build on.

- System 1 seller-facing API service in `server/`
- separate `/control` surface for runtime resets, world-state inspection, tournament orchestration, and day advancement
- seeded creative-goods marketplace with production-aware listings, orders, reviews, payments, taxonomy, and trend state
- System 2 simulation with inspectable day resolution for views, favorites, orders, delayed payments, delayed reviews, and production queue release
- transparent marketplace ranking based on relevance, listing quality, reviews, price fit, recency, and trend bonus
- Python `seller_core` client/CLI for the portability-aware seller surface
- Python single-shop owner-agent runtime with live morning briefing generation from seller-visible state
- turn-slot workday loop with one action per slot, runtime-owned day settlement, and resettable reference runs
- unified owner-agent memory with mutable scratchpad text, append-only journal entries, and reminders
- Mistral provider wiring for live tool-calling runs
- artifact-rich single-run bundles with briefings, turns, scratchpad state, journal history, reminders, and run summaries
- additive arena-style tournament orchestration with rotating entrant order, rotating shop assignments, and shared-world resets
- a committed React/Vite frontend shell for marketplace, shop, listing, and simulation overview pages

## In Motion

These are the current product priorities.

- turn Botique into a human-legible benchmark and demo surface, not just a runtime
- finish reconciling docs and operator-facing language with the current creative-goods / scratchpad / tournament reality
- make run artifacts first-class inputs for exploration, comparison, and presentation
- improve seller-facing briefings and tool ergonomics based on trace review when runs expose real issues
- keep the seller-facing / control-plane boundary disciplined while tournament and operator features expand

## Next

Near-term work that should most improve the benchmark and demo.

- build a run explorer over persisted artifact bundles
- build a comparison / leaderboard surface for single runs and tournament results
- add a tournament-focused frontend/operator view for entrants, rounds, standings, and replay
- add operator controls for reset, run launch, model selection, and artifact navigation
- define a cleaner benchmark scorecard and scenario labeling scheme for presentation
- keep making small trace-driven runtime refinements where the UI reveals real behavior problems

Note:

- prompt/tooling refinement is an empirical tuning activity, not the main planned product phase
- the system focus has shifted from “make one believable run possible” toward “make runs legible, comparable, and demo-ready”

## Later

Likely expansions once the benchmark and operator surfaces are in place.

- richer customer/cohort drift and longer-horizon demand modeling
- stronger scenario seeding and evaluation suites
- richer operator/debug traces explaining why listings did or did not perform
- more direct model-vs-model benchmarking beyond the current tournament baseline
- optional deeper portability work around a real Etsy-hookup story

## Open Questions

- what the primary public score should be for comparison and tournament standings
- which scenario seeds should become the canonical benchmark set
- how much scratchpad/journal/reminder context should be surfaced automatically versus pulled on demand
- what the best benchmark-facing presentation is for production pressure, backlog, and inventory state
- when to add stronger inter-shop competition beyond the current tournament/shared-world mechanics
- how much demo value there is in the Etsy-portability story relative to the core Botique benchmark

## Updating Rule

When project state changes, update this file first if the answer to any of these changes:

- what works now
- what is actively being built now
- what is clearly next
- what remains unresolved
