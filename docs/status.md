# Status

## Current Build State

The repo currently has three implemented code areas:

- `server/`: TypeScript Fastify/Bun seller-facing API, control routes, seeded marketplace state, and simulation logic
- `src/seller_core/`: Python portability-aware seller tool client/CLI
- `src/agent_runtime/`: Python owner-agent runtime, provider wiring, tool registry, and simple note/reminder memory

System 4 remains unimplemented in this repo.
## Current Default World

The default seeded world is now creative-goods-first rather than digital-first.

Current behavior:

- four small creative-goods shops seed the default market
- listings use `stocked` and `made_to_order` fulfillment modes on the same production model
- shops begin with asymmetric stock, backlog, review history, cash timing, and production capacity
- the default taxonomy now centers 3D printed goods, laser-cut decor, ceramics, and woodwork

This is a `Current decision` for the default benchmark direction.
## Current Runtime Contract

The owner-agent loop now runs as a turn-slotted seller workday.

Current behavior:

- each day starts with a visible number of work slots
- each tool call uses one slot
- the agent still gets one tool call per turn
- notes and reminders stay visible as ordinary support tools
- after the day ends, the runtime writes one model-generated note for later days outside the slot budget
- the runtime still owns day-end accounting and simulation advancement
- the provider-facing payload is now a natural morning brief plus compact work-session state instead of a raw orchestration JSON envelope

This is a `Current decision`.

## What Works Now

- live morning brief generation from seller-facing and control-plane state
- a narrower owner-agent tool surface with runtime-composed shop and listing summaries
- shop-scoped core and extension tool exposure behind that narrower runtime surface
- turn-slotted single-day loop execution
- multi-day runs with runtime-owned simulation advancement between days
- inspectable in-memory notes and reminders
- automatic end-of-day note carry-forward between days
- structured runtime event logs
- production-aware seeded world state with delayed payments, pending reviews, and shop queues

## Active Focus

Current focus is making one believable single-shop run feel like a constrained creative-goods business day rather than a hidden cost-shaping puzzle.

That means:

- keeping the loop legible
- keeping the tool surface explicit but narrower than raw `seller_core`
- improving prompt framing without adding hidden reasoning dependencies
- keeping production constraints visible without turning the benchmark into warehouse software

## Next Likely Improvements

- tune turns-per-day sizing against observed behavior
- enrich morning brief quality as more simulation outcomes exist
- tune how much production detail is surfaced to the owner agent without hiding important world state
- validate whether the new shop dashboard and listing drill-down reduce low-value bookkeeping in live runs
- add more outcome-rich day settlement in System 2 while keeping the same System 3 loop contract
- decide how much operator-facing replay/debug UI is needed for demos

## Open Questions

- whether the default `5` turns per day should stay or be tuned after more end-to-end runs
- whether reminder usage needs stronger guardrails if agents overuse support tools
- how rich post-tool state summaries should become before they feel noisy again
- how much direct production control should eventually be exposed versus staying world-owned
