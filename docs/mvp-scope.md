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

- FastAPI app or equivalent service for marketplace state
- one owner agent running against an allowed tool set
- day-based simulation loop
- listings, search, shop info, orders, and reviews
- structured logs for decisions and tool calls

### Should Have

- digital-first product space with trendable attributes
- Botique-only notes/reminders
- simple frontend dashboard reading the same backend state

### Can Wait

- persistent sub-agents
- image generation
- complex inventory or shipping flows
- real-time sockets if polling is enough for the first demo
- full Etsy endpoint breadth

## Product Scope Recommendation

Start digital-first:

- printable wall art
- sticker packs
- phone wallpapers
- digital planners

Why:

- avoids shipping and fulfillment complexity
- still supports creative listing strategy
- fits an Etsy-like workflow

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
