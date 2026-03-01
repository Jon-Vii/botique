# Botique Architecture

## Product Framing

Botique is a simulated e-commerce platform where autonomous AI agents run Etsy-like shops.

The project has two goals:

1. build a credible simulated marketplace where business-owner agents operate through tools
2. preserve a seller-facing subset that is intentionally compatible in spirit with Etsy Open API v3 patterns

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
- how to allocate constrained production capacity

## Research-Informed Design Rules

These are architecture-level defaults drawn from recent agent-business and e-commerce simulation work.

- the environment owns outcomes, delays, and failures
- agents act through tools, but the world decides what actually happens
- evaluation should center on one clear business objective plus supporting diagnostics
- explicit scratchpad/journal/reminder memory is preferable to opaque hidden memory systems
- a single-shop loop should be stable before richer competition or delegation becomes the norm
- narrative events should enrich the world, not replace formula-driven core mechanics
- operator-facing traceability is part of the product, not just a debugging convenience

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

Responsibilities:

- store shops, listings, orders, reviews, payments, customers, and production state
- resolve search, purchases, reviews, trend shifts, and production release
- advance the simulation clock
- own simulation time and world-state transitions

System 2 is the world the agents live in.

Current implementation note:

- Systems 1 and 2 currently ship inside the same TypeScript Fastify/Bun service, but the boundary is explicit in code: seller-facing routes/services live under `server/src/routes/` and `server/src/services/`, while simulation logic lives under `server/src/simulation/`

### System 1 / System 2 Boundary

For the current TypeScript server, keep the boundary explicit:

- System 1 owns HTTP routes, request validation, response shaping, and seller-facing compatibility behavior
- System 2 owns current day, market snapshot, trend state, ranking inputs, production state, and day advancement rules
- System 1 may call into System 2 to resolve world-derived results such as ranking context, but it should not embed simulation formulas inline in route handlers
- System 2 should expose inspectable interfaces for `current_day`, `market_snapshot`, `trend_state`, world reset, and day advancement
- advancing or resetting the world belongs to the control/runtime layer, not normal seller-facing routes

### System 3: Agent Orchestrator

Application code that manages LLM-driven agents.

System 3 is the agent runtime layer, not the simulated world itself. The marketplace environment and its state belong to Systems 1 and 2.

Responsibilities:

- generate morning briefings
- run the per-day/per-work-slot loop
- expose the allowed tool surface to each agent role
- manage explicit scratchpad/journal/reminder memory
- log decisions, tool calls, and outcomes
- orchestrate single-run and tournament modes

### System 4: Frontend / Operator Layer

Human-facing observation, comparison, and control layer.

Responsibilities:

- show marketplace state and shop dashboards
- display agent activity, scratchpad state, journal history, and customer interactions
- browse run artifacts and compare runs
- display tournament standings and replays
- expose safe operator controls such as reset and run launch

Current implementation note:

- a React/Vite frontend shell is already committed in `frontend/`
- the next System 4 phase is not “start a frontend,” but “turn the existing frontend into a benchmark/operator surface”

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

- production scheduling
- scratchpad, journal, and reminders
- benchmark-oriented seller support surfaces

### Control API

Runtime and operator surface for the simulation itself.

Examples:

- advance simulation day
- reset world state
- inspect global state
- snapshot and restore shared-world tournament state

The shop-running agent should not have access to the Control API.

Status: `Current decision`

## Naming Conventions

Use clear product-first naming:

- `seller_core/`
- `botique_extensions/`
- `agent_runtime/tools/`
- `control_api` as a logical surface name, not an Etsy-branded module

Keep Etsy mapping explicit but internal:

- `seller_core/compat/etsy_v3.py`
- `docs/agent-tools.md`

Status: `Recommended default`

## Current Decisions

- use a custom agent loop, not a managed agent platform
- use a creative-goods-first product space with constrained production
- start with one owner agent per shop as the clean baseline
- do not make delegation or multi-agent teams a baseline architectural assumption yet
- keep the compatibility story honest: portable seller actions are separate from Botique-only conveniences
- keep the single-shop isolated run as the default baseline, with tournament mode implemented as an additive System 3 extension rather than a replacement
- treat System 4 as a real product layer for benchmark legibility, not just optional polish

## Open Decisions

- exact public scorecard and leaderboard semantics
- exact benchmark scenario set
- how much scratchpad/journal/reminder context should be injected automatically
- whether trend visibility should stay briefing/search-driven or gain additional operator-facing summaries
- whether the first public demo includes human intervention controls or mostly read-only observation
