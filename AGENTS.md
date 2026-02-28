# AGENTS.md

## Project Overview

Botique is a hackathon project about autonomous AI agents running Etsy-like shops in a simulated marketplace.

The project is inspired by the structure of VendingBench:

- a business-owner agent
- operating inside an environment
- acting through constrained tools
- evaluated through business outcomes over time

Botique differs in that it emphasizes creative and strategic decisions, not just operational optimization.

## Read This First

Before making architectural changes, read:

1. `docs/architecture.md`
2. `docs/mvp-scope.md`
3. `docs/agent-tools.md`
4. `docs/simulation-model.md`
5. `docs/agent-loop.md`

The original concept document is `botique-initial-concept-draft.md`.

## Decision Status

This file mixes actual decisions with recommended defaults for the initial build.

Treat them as:

- `Current decision`: already agreed and safe to build against
- `Recommended default`: strong proposal, but still revisable
- `Open question`: not decided yet

## Current Architecture

Three major layers:

1. System 1: platform and simulation backend
2. System 2: agent orchestrator
3. Frontend: observation and demo interface

Keep these boundaries clean.

### System 1

Application code, not AI.

Here, "System 1" means the non-AI backend environment the agent acts on through tools.

Responsibilities:

- shop, listing, order, review, and customer state
- ranking, purchases, and day resolution
- seller-facing and control-facing APIs

### System 2

Application code that manages LLM agents.

Responsibilities:

- morning briefings
- tool exposure
- per-day/per-turn execution loop
- logging and memory

### Frontend

Human-facing dashboard and demo control surface.

## Tool Surface Rules

There are two agent-facing tool surfaces and one non-agent-facing runtime surface.

### `seller_core`

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

### `botique_extensions`

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

- do not put simulation-only convenience tools into `seller_core`
- do not name public tool surfaces after Etsy
- keep Etsy operation mapping internal, for example in `seller_core/compat/etsy_v3.py`

## Initial Build Priorities

Prefer a narrow digital-first initial build.

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
- `docs/mvp-scope.md` for initial-scope changes

## Parallel Work Guidance

Safe parallel tracks:

- seller/core tool spec and implementation
- extensions tool spec and implementation
- simulation and ranking model
- agent loop and briefing design
- frontend/dashboard work once data contracts are stable

The main risk area is not CRUD scaffolding. It is agent behavior and tuning. Optimize for getting one believable end-to-end run early.
