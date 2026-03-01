# Scope

## Goal

Produce a benchmark and demo where at least one shop-owner agent can:

1. Read a morning briefing
2. Inspect the market and its own shop
3. Manage constrained production and listings
4. Receive orders, delayed outcomes, and feedback
5. Adapt over multiple simulated days
6. Leave behind traces a human can inspect and compare

The active milestone is turning working runs into a compelling benchmark and demo surface.

## Capability Framing

Botique evaluates autonomous-organization capability, not just tool calling or seller roleplay.

The environment reveals:

- **Operational capability**: reprioritize, publish, price, produce, and respond to feedback
- **Strategic capability**: form a direction, test ideas, and shift based on evidence
- **Organizational memory**: preserve useful context and plans across days
- **Adaptive capability**: expand into adjacent opportunities or pivot when the current lane weakens
- **Resource governance**: manage cash, capacity, inventory, backlog, and risk

Evaluation layers:

1. In-lane optimization
2. Adjacent expansion
3. Gradual strategic pivot

## Product Scope

Creative-goods-first:

- 3D-printed decor and organizers
- Laser-cut decor and accessories
- Ceramics
- Woodwork

Shared simplifying abstraction:

- `stocked` or `made_to_order` fulfillment modes
- Finite daily production capacity
- Stock depletion or backlog growth after sales
- Material cost and lead time, without full shipping-carrier complexity

This creates real resource tradeoffs and makes pricing, replenishment, and catalog strategy legible.

## Success Criteria

The build is successful if:

- The agent takes actions through tools rather than freeform narration
- The market resolves outcomes externally
- The agent changes behavior based on results
- The agent operates under meaningful cash/capacity/inventory constraints
- Traces and artifacts make the strategy legible to a human observer
- Runs can be compared and presented cleanly through an operator-facing surface
