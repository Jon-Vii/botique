# Status

## Current Build State

The repo currently has three implemented code areas:

- `server/`: TypeScript Fastify/Bun seller-facing API, control routes, seeded marketplace state, and simulation logic
- `src/seller_core/`: Python portability-aware seller tool client/CLI
- `src/agent_runtime/`: Python owner-agent runtime, provider wiring, tool registry, and simple note/reminder memory

System 4 remains unimplemented in this repo.

## Current Runtime Contract

The owner-agent loop now runs as a budgeted seller workday.

Current behavior:

- each day starts with a visible work budget
- each tool call spends a small amount of that budget
- the agent still gets one tool call per turn
- notes and reminders stay visible as ordinary support tools
- the runtime still owns day-end accounting and simulation advancement
- the provider-facing payload is now a natural morning brief plus compact work-session state instead of a raw orchestration JSON envelope

This is a `Current decision`.

## What Works Now

- live morning brief generation from seller-facing and control-plane state
- shop-scoped core and extension tool exposure
- work-budgeted single-day loop execution
- multi-day runs with runtime-owned simulation advancement between days
- inspectable in-memory notes and reminders
- structured runtime event logs

## Active Focus

Current focus is making one believable single-shop run feel like a constrained business day rather than a turn quota.

That means:

- keeping the loop legible
- keeping the tool surface explicit
- improving prompt framing without adding hidden reasoning dependencies

## Next Likely Improvements

- tune work-budget sizing and per-tool costs against observed behavior
- enrich morning brief quality as more simulation outcomes exist
- add more outcome-rich day settlement in System 2 while keeping the same System 3 loop contract
- decide how much operator-facing replay/debug UI is needed for demos

## Open Questions

- whether the default work budget should stay at `8` or be tuned after more end-to-end runs
- whether reminder usage needs stronger guardrails if agents overuse support tools
- how rich post-tool state summaries should become before they feel noisy again
