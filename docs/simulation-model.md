# Simulation Model

## Goal

Create a marketplace that is structured enough to evaluate strategy, but open-ended enough to produce interesting behavior.

Status: `Recommended default`

## Product Space

Use a semi-structured creative-goods product model.

Recommended product schema:

- production method / business physics
- fulfillment mode
- quantity on hand
- backlog units
- material cost per unit
- capacity units per item
- lead time days
- title
- description
- tags
- materials
- price

Operational note:

- a listing should count as marketplace-active only when it is in `active` state and still has sellable capacity available
- `stocked` and `made_to_order` listings should share one production system underneath them
- stocked listings expose finished inventory; made-to-order listings expose queueable capacity, not infinite free fulfillment

Example combinatorial space:

- production methods: 3D printing, laser cutting, ceramics, woodwork
- product families: planters, wall signs, mugs, desk goods
- styles: minimal utility, heirloom, art deco, earth-tone studio
- personalization: stocked batch, custom engraving, made-to-order variation

Status: `Recommended default`

## Shops

Each shop has:

- identity and description
- active/draft listings
- balance and revenue history
- reviews
- strategy notes and reminders
- optional hired specialists later

## Starting State

Seed the world, not the agent.

Recommended starting context:

- one owned shop per evaluated agent
- a small surrounding market of competitor shops and listings
- taxonomy/category state
- some prior business history such as orders or reviews
- current simulation day and any active market conditions

Current implementation note:

- the current server seeds a small creative-goods market with four shops, production queues, listings, orders, reviews, payments, and taxonomy nodes
- the in-memory repository starts with that default seed, and the Postgres bootstrap uses the same seed when the database is empty or partially seeded
- the current simulation day is inferred from the latest seeded marketplace timestamp unless a world state provides an explicit day

This gives the agent a business to run and a world to react to without making the orchestrator responsible for world setup.

Status: `Recommended default`

## World State Ownership

System 2 should own an explicit world state rather than scattering simulation data across request handlers.

Recommended initial world-state shape:

- marketplace state: shops, listings, orders, reviews, payments, taxonomy
- current day: explicit day index and canonical simulation date
- market snapshot: inspectable aggregate counts and demand context
- trend state: active trend labels, taxonomy focus, and simple demand multipliers

The important boundary is that System 1 can read from this state, but System 2 owns how it is created and advanced.

## Customers

Use structured personas instead of generic random users.

Suggested persona attributes:

- style affinity
- price sensitivity
- quality sensitivity
- review tendency
- message tendency
- browsing pattern

## Demand Model

Keep the first version formula-driven.

Factors:

- base traffic per category
- trend multiplier
- tag/title relevance
- price competitiveness
- listing quality score
- shop reputation score
- backlog and lead-time drag can be layered in as fulfillment friction without changing the seller-facing contract

Purchase outcomes should be probabilistic, but based on deterministic features.

Status: `Recommended default`

## World-Owned Friction

The simulation should own uncertainty and business friction.

Examples:

- delayed purchases instead of immediate perfect feedback
- reviews arriving after orders, not at listing creation time
- production jobs completing on later days rather than immediately
- stocked listings going out of stock while made-to-order listings build backlog
- customers browsing without buying
- occasional negative or ambiguous outcomes even after sensible choices

This keeps the benchmark about operating inside a world, not just calling the right tool in the right order.

Status: `Recommended default`

## Ranking Model

Initial ranking can be a weighted score:

`ranking_score = relevance + quality + reputation + price_fit + recency_bonus`

This does not need to mimic Etsy perfectly. It needs to be stable, legible, and tunable.

Current implementation note:

- `server/src/simulation/ranking.ts` currently scores marketplace search with keyword relevance, deterministic listing quality, shop review average, price fit, recency bonus, taxonomy/tag trend bonus, and a small freshness bonus
- this is still intentionally transparent and formula-driven rather than LLM-judged

## Listing Quality

Prefer a deterministic first pass:

- tag relevance to trend and query
- title clarity
- description completeness
- category/style coherence

Avoid per-listing LLM judging in the first build.

Status: `Recommended default`

## Day Resolution

Each simulated day should include:

1. market state update
2. customer browsing and purchases
3. review generation
4. optional DM/event generation
5. shop-level daily summary creation

System 2 should own this process. System 3 consumes the resulting world state; it should not define the simulation rules themselves.

## First Advance-Day Pipeline

The first implementation should stay explicit and inspectable even as production is added.

Suggested initial pipeline:

1. advance the world clock by one day
2. refresh deterministic trend state
3. release completed production jobs into stock or fulfilled customer orders
4. settle delayed events such as payments and pending reviews
5. resolve market browsing and sales against current listings
6. allocate available production capacity across stock replenishment and made-to-order backlog
7. rebuild the market snapshot from the updated world state

This keeps the contract surface for `advanceDay` stable while letting the world own inventory, backlog, and delayed-outcome physics.

Current implementation note:

- `advanceDay` is already implemented with these inspectable steps and returns them in the control response payload

Recommended default for the first build:

- keep formulas simple and visible in code
- favor deterministic trend rotation over opaque randomness
- use one production queue model underneath both `stocked` and `made_to_order` listings
- do not require rich multi-business competition yet
- let later milestones add more realistic demand and purchase resolution on top of the same pipeline shape

## Evaluation Shape

Track one primary business score and a small set of supporting diagnostics.

Suggested primary score candidates:

- cumulative profit
- ending balance
- shop value proxy combining profit and reputation

Suggested diagnostics:

- order count
- conversion rate
- average review score
- listing diversity
- repeated failure or recovery patterns

The exact primary score is still an `Open question`, but the single-score-plus-diagnostics pattern is a `Recommended default`.

## Optional Narrative Layer

Low-frequency events can be generated later:

- pre-purchase customer questions
- complaints
- unusual requests
- trend shifts

This should enrich the simulation, not carry the core mechanics.

## Competition Rollout

Start with a single owned shop operating in a seeded market. Add stronger inter-shop competition only after the basic business loop is stable and legible.

Treat multi-business competition as a roadmap expansion unless it is explicitly pulled forward for a later demo milestone.

Status: `Recommended default`

## Tuning Goals

The model is good enough when:

- different strategies produce visibly different outcomes
- trends matter but do not dominate everything
- pricing matters but does not swamp product quality
- agents can recover from weak days through better choices
