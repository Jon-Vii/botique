# Architecture

## Product Framing

Botique is a simulated e-commerce platform where autonomous AI agents run creative-goods shops in a shared marketplace.

The project has two goals:

1. Build a credible simulated marketplace where business-owner agents operate through tools
2. Preserve a clean seller-facing API contract that could generalize beyond the simulation

## Research-Informed Design Rules

- The environment owns outcomes, delays, and failures
- Agents act through tools, but the world decides what actually happens
- Evaluation centers on one clear business objective plus supporting diagnostics
- Explicit scratchpad/journal/reminder memory is preferable to opaque hidden systems
- A single-shop loop should be stable before richer competition
- Narrative events enrich the world but do not replace formula-driven core mechanics
- Operator-facing traceability is part of the product, not just a debugging convenience

## System Split

Botique has four logical systems plus one bridge layer.

### System 1: Platform API Server

Application code, not AI.

- Exposes the seller-facing HTTP contract
- Validates and normalizes requests and responses
- Routes reads and writes into marketplace state
- Exposes control-facing endpoints for runtime orchestration

### System 2: Simulation Engine

Application code, not AI.

- Stores shops, listings, orders, reviews, payments, customers, and production state
- Resolves search, purchases, reviews, trend shifts, and production
- Advances the simulation clock
- Owns simulation time and world-state transitions

System 2 is the world the agents live in.

### System 3: Agent Orchestrator

Application code that manages LLM-driven agents.

- Generates morning briefings
- Runs the per-day/per-work-slot loop
- Exposes the allowed tool surface to each agent role
- Manages explicit scratchpad/journal/reminder memory
- Logs decisions, tool calls, and outcomes
- Orchestrates single-run and tournament modes

### System 4: Frontend / Operator Layer

Human-facing observation, comparison, and control layer.

- Shows marketplace state and shop dashboards
- Displays agent activity, memory state, and customer interactions
- Browses run artifacts and compares runs
- Displays tournament standings
- Exposes safe operator controls

### Bridge Layer: Seller Core

A portability-aware client/CLI contract layer between the agent runtime and seller-facing APIs.

## Modularity Principle

Each subsystem is independently runnable, testable, and replaceable. Modules communicate through explicit contracts, not hidden shared state. Implementation language may differ across modules.

## Interface Layers

### Agent Tools: Core

Portable, seller-facing tools:

- Listing creation and updates
- Shop info
- Marketplace search
- Orders and reviews

### Agent Tools: Extensions

Simulation-specific seller-facing tools:

- Production scheduling
- Scratchpad, journal, and reminders
- Benchmark-oriented seller support surfaces

### Control API

Runtime and operator surface for the simulation:

- Advance simulation day
- Reset world state
- Inspect global state
- Snapshot and restore tournament state

The shop-running agent does not have access to the Control API.

## Current Decisions

- Custom agent loop (not a managed agent platform)
- Creative-goods-first product space with constrained production
- One owner agent per shop as the clean baseline
- Single-shop isolated run as default, tournament mode as additive extension
- System 4 as a real product layer for benchmark legibility
