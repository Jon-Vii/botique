# Simulation Model

## Goal

Create a marketplace that is structured enough to evaluate strategy, but open-ended enough to produce interesting behavior.

## Capability Framing

Botique evaluates autonomous-organization capability under scarce resources, not just tool use or seller roleplay.

The simulation reveals:

- **operational capability**: can the agent reprioritize, publish, price, produce, and respond to feedback
- **strategic capability**: can it form a direction, test ideas, and shift based on evidence
- **organizational memory**: can it preserve useful context and plans across days
- **adaptive capability**: can it expand into adjacent opportunities or pivot when its current lane weakens
- **resource governance**: can it manage cash, capacity, inventory, backlog, and risk

Research-informed notes:

- [EcoGym](https://arxiv.org/abs/2602.09514) supports long-horizon economic environments with explicit resource budgets
- [AMA-Bench](https://arxiv.org/abs/2602.22769) reinforces that stateful memory should stay explicit, causal, and inspectable
- [PhysicsAgentABM](https://arxiv.org/abs/2602.06030) supports structured cohort-level world simulation over expensive freeform per-agent roleplay

## Product Space

A semi-structured creative-goods model with explicit production constraints.

Product schema includes product family, style, subject, title, description, tags, materials, price, production mode, inventory, material costs, and lead times.

Example combinatorial space:

- product families: planters, organizers, wall decor, mugs, trays, ornaments, small storage, desk accessories
- styles: minimalist, retro, kawaii, cottagecore
- subjects: cats, mushrooms, mountains, florals, celestial

Production modes:

- **stocked**: units are produced ahead of time and depleted by sales
- **made_to_order**: sales create backlog that consumes future production capacity

Agent-managed shops must explicitly schedule future stocked production. Background NPC shops use a baseline stocking policy so the surrounding market stays active.

## Shop Archetypes

All shops operate as 3D printing shops within a single shared taxonomy. This creates direct head-to-head competition for fixed daily traffic, where share-of-voice depends on listing quality, pricing, and trend fit.

Product niches within 3D printing include planters, desk accessories, decorative art, kitchen organizers, and custom-fit utility items. The agent is free to create listings in any niche — the strategic question is which products to make and how to position them against NPC competitors.

## Starting State

The world is seeded, not the agent.

Each run begins with:

- one owned shop per evaluated agent
- a surrounding market of competitor shops and listings
- taxonomy and category state
- prior business history (orders, reviews, payments)
- current simulation day and any active market conditions

Two canonical scenario seeds:

- **operate**: existing business with active catalog, historical orders, reviews, and payments
- **bootstrap**: zero listings, limited cash, but real shop identity and surrounding competitors

## Demand Model

The demand model is entirely formula-driven. No LLM is involved in sales outcomes.

### Staged Pipeline

Demand resolves through explicit stages:

1. **Taxonomy traffic**: fixed daily buyer sessions per category (no scaling with listing count), influenced by trends — traffic is a finite resource that shops compete for
2. **Discoverability**: views allocated across active listings based on quality, reputation, freshness, trend fit, and price competitiveness
3. **Conversion**: a subset of views convert into favorites and orders based on listing quality, shop reputation, pricing, and trend alignment
4. **Fulfillment consequences**: stock is decremented or backlog grows, triggering production queue effects
5. **Delayed outcomes**: payments post after a delay, reviews arrive days later — not immediately

### Customer Cohorts

The model uses a set of customer cohorts with distinct preferences and behaviors. Each cohort has different sensitivity to price, quality, reviews, trends, and browsing depth. This creates meaningful tradeoffs in pricing, positioning, and catalog strategy without requiring fully autonomous customer agents.

Cohort state is hidden from the seller agent. The agent sees only downstream effects: views, favorites, orders, reviews, and market signals.

### What Makes This Credible

The model is calibrated so that:

- pricing changes clearly help or hurt demand
- better listing quality can recover some pricing mistakes, but not erase them
- reputation matters more for conversion than for initial traffic
- trend lift creates opportunity without dominating all other terms
- the same listing does not receive identical outcomes every day
- delayed reviews and payments are downstream of sales, not baked into a single reward number

## World-Owned Friction

The simulation owns uncertainty and business friction:

- delayed purchases instead of immediate feedback
- reviews arriving days after orders
- production jobs completing on later days
- stock-outs and backlog pressure after good demand
- customers browsing without buying
- occasional negative outcomes even after sensible choices

This keeps the benchmark about operating inside a world, not just calling the right tool in the right order.

## Ranking

Marketplace search uses a transparent, formula-driven ranking score combining relevance, quality, reputation, price fit, recency, and trend bonus. This is intentionally legible and tunable rather than opaque.

## Listing Quality

Quality scoring is deterministic, based on tag relevance, title clarity, description completeness, and category/style coherence. No per-listing LLM judging.

## Evaluation Shape

Each run tracks a primary business score plus supporting diagnostics:

- **Primary**: cumulative profit, ending balance, or a shop value proxy
- **Diagnostics**: order count, conversion rate, average review score, stock-out rate, cash spent on production, listing diversity, recovery patterns

## Tuning Goals

The model is good enough when:

- different strategies produce visibly different outcomes
- trends matter but do not dominate everything
- pricing matters but does not swamp product quality
- agents can recover from weak days through better choices
