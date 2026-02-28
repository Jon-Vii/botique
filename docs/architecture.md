# Botique Architecture

## Product Framing

Botique is a simulated e-commerce platform where autonomous AI agents run Etsy-like shops.

The project has two goals:

1. Build a credible simulated marketplace where business-owner agents operate through tools.
2. Preserve a seller-facing subset that is intentionally compatible in spirit with Etsy Open API v3 patterns.

Botique is not an Etsy client. The compatibility claim is limited to a subset of seller operations.

Status: `Current decision`

## Core Research Framing

Botique is informed by adjacent agent-business work such as VendingBench, but it is not an attempt to recreate those systems or mechanics.

At a high level, Botique shares this structure:

- an AI business-owner agent
- embedded in an environment
- acting through constrained tools
- evaluated through business outcomes over time

The main difference is that Botique includes creative and strategic choices:

- what products to create
- how to position them
- how to price them
- how to react to competitors and customer feedback

## Research-Informed Design Rules

These are architecture-level defaults drawn from recent agent-business and e-commerce simulation work.

- the environment owns outcomes, delays, and failures
- agents act through tools, but the world decides what actually happens
- evaluation should center on one clear business objective plus supporting diagnostics
- simple notes and reminders are preferable to opaque memory systems in the initial build
- a single-shop loop should be stable before adding richer competition or multi-agent delegation
- narrative events should enrich the world, not replace formula-driven core mechanics

Status: `Recommended default`

## System Split

Botique has four logical systems plus one bridge layer.

### System 1: Platform API Server

Application code, not AI.

Responsibilities:

- expose the seller-facing HTTP contract
- validate and normalize requests and responses
- route reads and writes into the underlying marketplace state
- expose control-facing endpoints where appropriate

### System 2: Simulation Engine

Application code, not AI.

Here, "System 1" means the non-AI backend environment the agent acts on through tools.

Responsibilities:

- store shops, listings, orders, reviews, and customers
- resolve search, purchases, reviews, and trend shifts
- advance the simulation clock
- own simulation time and world-state transitions

System 2 is the world the agents live in.

### System 1 / System 2 Boundary

For the current TypeScript server, keep the boundary explicit:

- System 1 owns HTTP routes, request validation, response shaping, and seller-facing compatibility behavior.
- System 2 owns current day, market snapshot, trend state, ranking inputs, and day advancement rules.
- System 1 may call into System 2 to resolve world-derived results such as ranking context, but it should not embed simulation formulas inline in route handlers.
- System 2 should expose inspectable interfaces for `current_day`, `market_snapshot`, `trend_state`, and `advanceDay`.
- advancing the world belongs to the control/runtime layer, not normal seller-facing routes.

Current implementation note:

- `server/src/routes/` and the seller-facing parts of `MarketplaceService` are System 1 concerns.
- `server/src/routes/control-routes.ts` exposes a separate `/control` surface for runtime/operator access to simulation state and day advancement.
- `server/src/simulation/` is the System 2 module boundary inside the current codebase.
- the HTTP contract stays unchanged while System 2 evolves behind that boundary.

### System 3: Agent Orchestrator

Application code that manages LLM-driven agents.

System 3 is the agent runtime layer, not the simulated world itself. The marketplace environment and its state belong to Systems 1 and 2.

Responsibilities:

- generate morning briefings
- run the per-day/per-turn loop
- expose the allowed tool surface to each agent role
- log decisions, tool calls, and outcomes

### System 4: Frontend / Operator Layer

Human observation and intervention layer.

Responsibilities:

- show marketplace state and shop dashboards
- display agent activity and customer interactions
- optionally trigger control actions during demos

### Bridge Layer: `seller_core`

This is not one of the four major systems. It is the portability-aware client/CLI contract layer between the agent runtime and seller-facing APIs.

## Modularity Principle

Each major Botique subsystem should be independently runnable, testable, and replaceable.

That means:

- `seller_core` is a standalone client/CLI contract layer
- System 1 is a standalone seller-facing API server
- System 2 is a standalone simulation/world engine with its own state and time model
- System 3 is a standalone orchestrator that depends only on published tool/API contracts
- System 4 depends on published backend/control interfaces, not internal implementation details

Implications:

- modules communicate through explicit contracts, not hidden shared state
- implementation language may differ across modules
- each module should have a useful standalone mode for development and testing
- swapping one implementation should not require redesigning the others

## Interface Layers

### Agent Tools: Core

Portable, seller-facing tools that map to the Etsy-compatible subset.

Examples:

- listing creation and updates
- shop info
- marketplace search
- receipts/orders
- reviews

### Agent Tools: Extensions

Seller-facing tools that exist only inside Botique.

Examples:

- marketplace trends
- notes and reminders
- optional delegation helpers

### Control API

Runtime and operator surface for the simulation itself.

Examples:

- advance simulation day
- inject events
- inspect global state
- seed shops or customers

The shop-running agent should not have access to the Control API.

Status: `Current decision`

## Naming Conventions

Use clear product-first naming:

- `seller_core/`
- `botique_extensions/`
- `agent_runtime/tools/`
- `control_api.py`

Keep Etsy mapping explicit but internal:

- `seller_core/compat/etsy_v3.py`
- `docs/agent-tools.md`

Implementation guidance:

- `seller_core` is the reusable portable seller surface client/CLI package
- `agent_runtime/tools/` is where Botique-specific tool registration and role exposure can live later
- do not use `agent_tools` as a catch-all package for transport, schemas, and runtime concerns

Status: `Recommended default`

## Current Decisions

- Use a custom agent loop, not a managed agent platform.
- Keep the initial build digital-first to avoid shipping complexity.
- Start with one owner agent per shop.
- Do not make delegation or multi-agent teams a baseline architectural assumption yet.
- Keep the compatibility story honest: portable seller actions are separate from Botique-only conveniences.

## Open Decisions

- exact digital-first product categories
- exact initial tool list for orders, reviews, taxonomy, and media
- whether/when to add delegation or sub-agents
- whether trend visibility should be direct (`get_marketplace_trends`) or inferred through marketplace search
- whether the first public demo includes human customer interaction or only observation
