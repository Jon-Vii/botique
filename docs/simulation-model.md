# Simulation Model

## Goal

Create a marketplace that is structured enough to evaluate strategy, but open-ended enough to produce interesting behavior.

Status: `Recommended default`

## Product Space

Use a semi-structured digital product model.

Recommended product schema:

- base type
- style
- subject
- title
- description
- tags
- price

Example combinatorial space:

- base types: sticker pack, wall art print, phone wallpaper, planner
- styles: minimalist, retro, kawaii, cottagecore
- subjects: cats, mushrooms, mountains, florals, celestial

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

This gives the agent a business to run and a world to react to without making the orchestrator responsible for world setup.

Status: `Recommended default`

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

Purchase outcomes should be probabilistic, but based on deterministic features.

Status: `Recommended default`

## World-Owned Friction

The simulation should own uncertainty and business friction.

Examples:

- delayed purchases instead of immediate perfect feedback
- reviews arriving after orders, not at listing creation time
- customers browsing without buying
- occasional negative or ambiguous outcomes even after sensible choices

This keeps the benchmark about operating inside a world, not just calling the right tool in the right order.

Status: `Recommended default`

## Ranking Model

Initial ranking can be a weighted score:

`ranking_score = relevance + quality + reputation + price_fit + recency_bonus`

This does not need to mimic Etsy perfectly. It needs to be stable, legible, and tunable.

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
