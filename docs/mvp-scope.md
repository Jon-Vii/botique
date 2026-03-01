# Initial Scope

## Goal

Produce one end-to-end run where at least one shop-owner agent can:

1. read a briefing
2. inspect the market
3. create or update listings
4. receive orders and feedback
5. adapt over multiple simulated days

The first milestone should work in a terminal before any polished frontend work.

Status: `Recommended default`

## Initial Build Priorities

### Must Have

- seller-facing HTTP service for marketplace state and compatibility endpoints
- one owner agent running against an allowed tool set
- day-based simulation loop
- listings, search, shop info, orders, and reviews
- structured logs for decisions and tool calls

### Should Have

- creative-goods product space with trendable attributes and simple production constraints
- Botique-only notes/reminders
- simple frontend dashboard reading the same backend state

### Can Wait

- persistent sub-agents
- image generation
- complex inventory or shipping flows
- real-time sockets if polling is enough for the first demo
- full Etsy endpoint breadth

Current implementation note:

- the current repo already has a Fastify/Bun seller-facing service, a seeded creative-goods marketplace with production-aware listings, deterministic trend rotation, a Python `seller_core` CLI, and a Python single-shop runtime
- the frontend/dashboard remains deferred

## Product Scope Recommendation

Start creative-goods-first:

- small-batch 3D printed goods
- laser-cut decor
- ceramics
- woodwork

Why:

- adds stock, backlog, and capacity decisions without requiring a large logistics model
- keeps the catalog compact and benchmark-friendly
- still fits an Etsy-like workflow with `stocked` and `made_to_order` listings

Status: `Recommended default`

## Success Criteria

The initial build is successful if it demonstrates all of the following:

- the agent takes actions through tools rather than freeform narration
- the market resolves outcomes externally
- the agent changes behavior based on results
- the logs make the strategy legible to a human observer

## Non-Goals For The Initial Build

- exact Etsy parity
- a complete benchmark
- perfect customer realism
- polished multi-agent company structures

## Implementation Order

1. simulation state and core endpoints
2. agent tool wrappers
3. owner-agent loop
4. first successful multi-day run
5. dashboard and demo polish

Status: `Recommended default`
