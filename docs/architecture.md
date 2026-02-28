# Botique Architecture

## Product Framing

Botique is a simulated e-commerce platform where autonomous AI agents run Etsy-like shops.

The project has two goals:

1. Build a credible simulated marketplace where business-owner agents operate through tools.
2. Preserve a seller-facing subset that is intentionally compatible in spirit with Etsy Open API v3 patterns.

Botique is not an Etsy client. The compatibility claim is limited to a subset of seller operations.

Status: `Current decision`

## Core Research Framing

Botique is structurally similar to VendingBench:

- an AI business-owner agent
- embedded in an environment
- acting through constrained tools
- evaluated through business outcomes over time

The main difference is that Botique includes creative and strategic choices:

- what products to create
- how to position them
- how to price them
- how to react to competitors and customer feedback

## System Split

### System 1: Platform + Simulation

Application code, not AI.

Here, "System 1" means the non-AI backend environment the agent acts on through tools.

Responsibilities:

- store shops, listings, orders, reviews, and customers
- resolve search, purchases, reviews, and trend shifts
- advance the simulation clock
- expose seller-facing and control-facing APIs

### System 2: Agent Orchestrator

Application code that manages LLM-driven agents.

Responsibilities:

- generate morning briefings
- run the per-day/per-turn loop
- expose the allowed tool surface to each agent role
- log decisions, tool calls, and outcomes

### Frontend

Human observation and intervention layer.

Responsibilities:

- show marketplace state and shop dashboards
- display agent activity and customer interactions
- optionally trigger control actions during demos

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
