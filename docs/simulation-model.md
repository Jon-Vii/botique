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

Avoid per-listing LLM judging in the first MVP.

Status: `Recommended default`

## Day Resolution

Each simulated day should include:

1. market state update
2. customer browsing and purchases
3. review generation
4. optional DM/event generation
5. shop-level daily summary creation

## Optional Narrative Layer

Low-frequency events can be generated later:

- pre-purchase customer questions
- complaints
- unusual requests
- trend shifts

This should enrich the simulation, not carry the core mechanics.

## Tuning Goals

The model is good enough when:

- different strategies produce visibly different outcomes
- trends matter but do not dominate everything
- pricing matters but does not swamp product quality
- agents can recover from weak days through better choices
