# Status

Last updated: `2026-03-01`

## Current

These pieces already exist and are safe to build on.

- Seller-facing API service with separate control surface for runtime orchestration
- Single-taxonomy 3D printing marketplace: four shops (one agent-controlled, three NPC) competing in the same category for fixed daily traffic
- Deterministic scenario seeding with canonical `operate` and `bootstrap` setups
- Fixed-traffic demand pipeline: capped taxonomy-level sessions split by share-of-voice, per-view conversion, and inventory/backlog consequences — agent strategy directly affects traffic capture
- Transparent marketplace ranking based on relevance, listing quality, reviews, price fit, recency, and trend bonus
- Python seller client/CLI for the portable seller surface
- Python owner-agent runtime with live morning briefing generation
- Turn-slot workday loop with runtime-owned day settlement and resettable reference runs
- Unified owner-agent memory: end-of-day scratchpad revision, append-only journal, and reminders
- Mistral provider wiring for live tool-calling runs
- Artifact-rich run bundles with briefings, turns, scratchpad state, journal history, reminders, and run summaries
- Arena-style tournament orchestration with rotating entrant order and shop assignments
- React/Vite frontend for marketplace, shop, listing, and simulation overview
- Frontend operator controls for scenario-aware run and tournament launch

## In Motion

- Turn Botique into a human-legible benchmark and demo surface
- Make run artifacts first-class inputs for exploration, comparison, and presentation
- Improve seller-facing briefings and tool ergonomics based on trace review
- Keep the seller-facing / control-plane boundary disciplined

## Next

- Build a run explorer over persisted artifact bundles
- Build a comparison / leaderboard surface for single runs and tournament results
- Add tournament-focused frontend/operator views
- Add operator controls for reset, model selection, and artifact navigation
- Trace-driven runtime refinements where the UI reveals real behavior problems

## Open Questions

- What the primary public score should be for comparison and tournament standings
- Which additional scenario seeds should join `operate` and `bootstrap`
- How much memory context should be surfaced automatically versus pulled on demand
- What the best benchmark-facing presentation is for production pressure and inventory state
- Whether to expand beyond the single 3D printing taxonomy to test multi-category expansion strategies
