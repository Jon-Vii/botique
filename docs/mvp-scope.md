# Initial Scope

## Goal

Produce a benchmark and demo where at least one shop-owner agent can:

1. read a morning briefing
2. inspect the market and its own shop
3. manage constrained production and listings
4. receive orders, delayed outcomes, and feedback
5. adapt over multiple simulated days
6. leave behind traces a human can inspect and compare

The original milestone was “make one believable run work in a terminal.” That now exists. The active milestone is turning those runs into a compelling benchmark and demo surface.

Status: `Current decision`

## Capability Framing

Botique should evaluate autonomous-organization capability, not just tool calling or seller roleplay.

The environment should be strong enough to reveal:

- operational capability: can the agent reprioritize, publish, price, produce, and respond to feedback
- strategic capability: can it form a direction, test ideas, and shift based on evidence
- organizational memory: can it preserve useful workspace text, workspace-history entries, reminders, and plans across days
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
- production-aware listings, search, shop info, orders, reviews, and payments
- structured logs and persisted artifacts for decisions and tool calls

### Should Have

- creative-goods-first product space with trendable attributes and production constraints
- unified workspace/reminders memory
- run explorer, comparison view, and tournament/demo surfaces built over the same runtime artifacts

### Can Wait

- persistent sub-agents
- image generation
- complex shipping or carrier flows
- real-time sockets if polling is enough for the first demo
- full Etsy endpoint breadth

Current implementation note:

- the repo already has a Fastify/Bun seller-facing service, a seeded creative-goods marketplace with production-aware listings, deterministic trend rotation, a Python `seller_core` CLI, a Python owner-agent runtime, automatic artifact bundles, and tournament mode
- the repo also already has a React/Vite frontend shell for marketplace and shop observation; the next step is turning it into a benchmark/operator surface rather than starting System 4 from zero

## Product Scope Recommendation

Start creative-goods-first:

- 3D-printed decor and organizers
- laser-cut decor and accessories
- ceramics
- woodwork

Shared simplifying abstraction:

- `fulfillment_mode`: `stocked` or `made_to_order`
- finite daily production capacity
- stock depletion or backlog growth after sales
- material cost and lead time, without full shipping-carrier complexity

Why:

- creates real resource tradeoffs without requiring full logistics simulation
- makes pricing, replenishment, and catalog strategy legible
- lets the agent exhibit organizational capability instead of only copywriting behavior

Status: `Current decision`

## Success Criteria

The initial build is successful if it demonstrates all of the following:

- the agent takes actions through tools rather than freeform narration
- the market resolves outcomes externally
- the agent changes behavior based on results
- the agent operates under meaningful cash/capacity/inventory constraints
- traces and artifacts make the strategy legible to a human observer
- runs can be compared and presented cleanly through an operator-facing surface

## Non-Goals For The Initial Build

- exact Etsy parity
- a complete academic benchmark suite
- perfect customer realism
- polished multi-agent company structures
- full physical-commerce fulfillment realism

## Implementation Order

1. simulation state and core endpoints
2. agent tool wrappers
3. owner-agent loop
4. first successful multi-day runs with artifacts
5. benchmark/operator UX over those runs
6. scenario and leaderboard polish

Status: `Current decision`
