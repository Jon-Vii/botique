# AGENTS.md

## Project Overview

Botique is a hackathon project about autonomous AI agents running Etsy-like shops in a simulated marketplace.

The project is informed by adjacent agent-business work such as VendingBench:

- a business-owner agent
- operating inside an environment
- acting through constrained tools
- evaluated through business outcomes over time

Botique is not trying to recreate VendingBench. It emphasizes creative and strategic decisions, not just operational optimization.

## Research-Informed Defaults

Unless a doc says otherwise, prefer these defaults:

- the world owns outcomes, delays, and failures
- agents should optimize for one explicit business objective plus supporting diagnostics
- simple notes/reminders come before complex memory systems
- single-shop runs should be stable before richer competition or delegation
- narrative events should enrich the simulation, not become the main mechanic
- multi-business competition is a later expansion unless a doc explicitly promotes it into the initial build

## Read This First

Before making architectural changes, read:

1. `docs/architecture.md`
2. `docs/mvp-scope.md`
3. `docs/agent-tools.md`
4. `docs/simulation-model.md`
5. `docs/agent-loop.md`

The original concept document is `botique-initial-concept-draft.md`.

## Decision Status

This file mixes actual decisions with recommended defaults for the MVP.

Treat them as:

- `Current decision`: already agreed and safe to build against
- `Recommended default`: strong proposal, but still revisable
- `Open question`: not decided yet

## Current Architecture

Four logical systems plus one bridge layer:

1. System 1: platform API server
2. System 2: simulation engine
3. System 3: agent orchestrator
4. System 4: frontend / operator layer

Keep these boundaries clean.

### System 1

Application code, not AI.

Responsibilities:

- seller-facing HTTP contract
- request/response validation
- routing reads and writes into marketplace state
- control-facing endpoints where needed

### System 2

Application code, not AI.

Responsibilities:

- shop, listing, order, review, and customer state
- ranking, purchases, reviews, and trend shifts
- simulation time and day resolution

### System 3

Application code that manages LLM agents.

System 3 is the agent runtime layer. The simulated marketplace environment and its state belong to Systems 1 and 2.

Responsibilities:

- morning briefings
- tool exposure
- per-day/per-turn execution loop
- logging and memory

### System 4

Human-facing dashboard and demo control surface.

### Bridge Layer

`seller_core` is the portability-aware client/CLI contract layer between the agent runtime and seller-facing APIs. It is not one of the four major systems.

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

## Tool Surface Rules

There are two agent-facing tool surfaces and one non-agent-facing runtime surface.

### `agent_tools/core`

Portable, seller-facing tools. This is the Etsy-compatible subset in spirit and structure.

Examples:

- `create_draft_listing`
- `update_listing`
- `get_listing`
- `get_shop_listings`
- `search_marketplace`
- `get_shop_info`
- `update_shop`
- `get_orders`
- `get_order_details`
- `get_reviews`
- `get_taxonomy_nodes`

Status: `Recommended default` on exact tool list, `Current decision` on having a portable core surface

### `agent_tools/extensions`

Botique-only seller tools. Useful for research and simulation richness, but not part of the portability story.

Examples:

- `write_note`
- `read_notes`
- `set_reminder`
- `get_balance`
- `get_marketplace_trends`

Status: `Recommended default`

### `control_api`

Not for normal seller agents.

Used by:

- simulation runner
- orchestrator/backend
- operator controls
- frontend demo tools

Examples:

- `advance_day`
- `inject_event`
- `get_global_market_state`
- `seed_customers`
- `start_run`
- `pause_run`
- `reset_run`

Do not blur `control_api` into the seller-facing tool layer.

Status: `Current decision`

## Portability Rules

Botique is not an Etsy client.

The claim is narrower:

- Botique exposes a seller-facing subset intentionally shaped to be compatible with Etsy Open API v3 patterns.

Keep this honest:

- do not put simulation-only convenience tools into `agent_tools/core`
- do not name public tool surfaces after Etsy
- keep Etsy operation mapping internal, for example in `compat/etsy_v3.py`

## MVP Priorities

Prefer a narrow digital-first MVP.

Start with:

- one owner agent per shop
- listings, search, shop info, orders, reviews
- day-based simulation
- simple notes/reminders
- structured logs

Defer unless needed:

- persistent multi-agent teams
- shipping-heavy product flows
- image generation
- broad endpoint coverage
- sophisticated realtime infrastructure

Status: `Recommended default`

## Product Scope Guidance

Default to digital-first products:

- sticker packs
- printable wall art
- phone wallpapers
- digital planners

This keeps the simulation Etsy-like without pulling in shipping complexity too early.

## Agent Loop Guidance

The main loop should remain simple and inspectable:

1. resolve day state
2. generate morning briefing
3. allow bounded turns
4. one tool call per turn
5. persist logs, notes, and reminders

Guard against:

- repetitive loops
- ambiguous timing
- hidden environment powers
- overreliance on Botique-only extensions when market evidence should drive decisions

## Documentation Workflow

When making meaningful decisions, update the corresponding doc in `docs/`.

Use:

- `docs/architecture.md` for system boundaries and naming
- `docs/agent-tools.md` for tool changes
- `docs/simulation-model.md` for market logic
- `docs/agent-loop.md` for prompt/turn/briefing changes
- `docs/mvp-scope.md` for scope changes

## Parallel Work Guidance

Safe parallel tracks:

- seller/core tool spec and implementation
- extensions tool spec and implementation
- simulation and ranking model
- agent loop and briefing design
- frontend/dashboard work once data contracts are stable

The main risk area is not CRUD scaffolding. It is agent behavior and tuning. Optimize for getting one believable end-to-end run early.
