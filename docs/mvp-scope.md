# Initial Scope

## Goal

Produce one end-to-end run where at least one shop-owner agent can:

1. read a briefing
2. inspect the market
3. manage constrained production and listings
4. receive orders, delayed outcomes, and feedback
5. adapt over multiple simulated days

The first milestone should work in a terminal before any polished frontend work.

Status: `Recommended default`

## Capability Framing

Botique should evaluate autonomous-organization capability, not just tool calling or seller roleplay.

The initial environment should be strong enough to reveal:

- operational capability: can the agent restock, reprioritize, publish, price, and respond to feedback
- strategic capability: can it form a direction, test ideas, and shift based on evidence
- organizational memory: can it preserve useful notes, reminders, and plans across days
- adaptive capability: can it expand into adjacent opportunities or begin a pivot when the current lane weakens
- resource governance: can it manage cash, capacity, inventory, backlog, and risk instead of simply doing more actions

Recommended evaluation layers:

1. in-lane optimization
2. adjacent expansion
3. gradual strategic pivot

Status: `Current decision`

## Initial Build Priorities

### Must Have

- seller-facing HTTP service for marketplace state and compatibility endpoints
- one owner agent running against an allowed tool set
- day-based simulation loop
- listings, search, shop info, orders, and reviews
- structured logs for decisions and tool calls

### Should Have

- creative-goods-first product space with trendable attributes and production constraints
- Botique-only notes/reminders
- simple frontend dashboard reading the same backend state

### Can Wait

- persistent sub-agents
- image generation
- complex shipping or carrier flows
- real-time sockets if polling is enough for the first demo
- full Etsy endpoint breadth

Current implementation note:

- the current repo already has a Fastify/Bun seller-facing service, seeded marketplace state, deterministic trend rotation, a Python `seller_core` CLI, and a Python single-shop runtime
- the frontend/dashboard remains deferred

## Product Scope Recommendation

Start creative-goods-first:

- 3D-printed decor and organizers
- laser-cut decor and accessories
- ceramics
- woodwork

Shared simplifying abstraction:

- `production_mode`: `stocked` or `made_to_order`
- finite daily production capacity
- stock depletion or backlog growth after sales
- material cost and lead time, without full shipping-carrier complexity

Why:

- creates real resource tradeoffs without requiring full logistics simulation
- makes pricing, replenishment, and catalog strategy legible
- lets the agent exhibit organizational capability instead of only copywriting behavior

Current implementation note:

- the current seed data and taxonomy are still digital-first; this section defines the next intended scope, not a completed migration

Status: `Current decision`

## Success Criteria

The initial build is successful if it demonstrates all of the following:

- the agent takes actions through tools rather than freeform narration
- the market resolves outcomes externally
- the agent changes behavior based on results
- the agent operates under meaningful cash/capacity/inventory constraints
- the logs make the strategy legible to a human observer

## Non-Goals For The Initial Build

- exact Etsy parity
- a complete benchmark
- perfect customer realism
- polished multi-agent company structures
- full physical-commerce fulfillment realism

## Implementation Order

1. simulation state and core endpoints
2. agent tool wrappers
3. owner-agent loop
4. first successful multi-day run
5. dashboard and demo polish

Status: `Recommended default`
