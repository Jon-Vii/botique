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

Operational note:

- a listing should count as marketplace-active only when it is in `active` state and still has enabled inventory available

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

Current implementation note:

- the current server seeds a small digital-first market with taxonomy nodes, two shops, listings, orders, reviews, and payments
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
- pending events: delayed world-owned outcomes such as payment posting and review delivery
- last day resolution: compact per-listing and per-day consequences from the most recent `advanceDay`

The important boundary is that System 1 can read from this state, but System 2 owns how it is created and advanced.

## Customers

Use cohort-weighted buyer sessions instead of generic random users or fully freeform customer agents.

Why this shape:

- [VendingBench](https://arxiv.org/abs/2410.11623) and [Vending-Bench 2](https://arxiv.org/abs/2509.14629) are worth borrowing from at the environment level: explicit business goals, world-owned outcomes, and delayed consequences that the agent must react to
- [PAARS](https://arxiv.org/abs/2502.11127) and [OPeRA](https://arxiv.org/abs/2502.17908) support using structured personas with preferences and observable history instead of unconstrained roleplay
- [BehaviorChain](https://arxiv.org/abs/2501.04587) and [ECom-Bench](https://arxiv.org/abs/2505.21119) reinforce that long-horizon user simulation is still brittle enough that Botique should keep discoverability, conversion, and reviews formula-driven in System 2

Status: `Current decision` for hackathon scope

### Scope Decision

For the first Botique customer model:

- do not create persistent freeform customer agents
- do not let sellers see raw cohort labels or hidden intent state
- do create a small, static set of customer cohorts that System 2 uses to generate daily buyer sessions
- do keep customer behavior inspectable enough that a control/debug surface can explain why listings got views, favorites, orders, or reviews

This is intentionally narrower than a benchmark with fully autonomous shoppers. The goal is better demand resolution, not a second agent society.

### Cohort Schema

Recommended hidden cohort fields:

- `cohort_id`: stable internal identifier
- `label`: human-readable internal name for debugging and docs
- `base_share`: default fraction of daily buyer sessions allocated to the cohort
- `preferred_base_types`: supported listing types this cohort tends to buy
- `preferred_taxonomy_ids`: optional taxonomy bias if stronger than base type bias
- `preferred_styles`: favored style tags or descriptors
- `preferred_subjects`: favored subject tags or descriptors
- `target_price`: comfortable expected price point for a good fit listing
- `price_ceiling`: soft upper limit before conversion drops sharply
- `price_sensitivity`: how strongly over-budget pricing hurts conversion
- `quality_sensitivity`: how strongly listing quality and description completeness matter
- `review_reliance`: how strongly shop reputation and existing reviews matter
- `trend_response`: how strongly active trend multipliers affect interest
- `browse_depth`: how many search results this cohort is likely to consider before dropping off
- `favorite_rate`: how likely the cohort is to favorite a listing that fits but does not yet convert
- `review_rate`: baseline chance of leaving a review after purchase
- `negative_review_bias`: how likely disappointment is to produce a review compared with satisfaction
- `repeat_purchase_affinity`: how willing the cohort is to buy again from a shop or niche it already trusts

Recommended hidden per-session fields:

- `session_id`
- `day`
- `cohort_id`
- `intent_base_type`
- `intent_taxonomy_id`
- `intent_tags`
- `budget`
- `results_considered`
- `purchase_threshold`
- `purchased_listing_id`
- `satisfaction_score`
- `pending_review_due_day`

Hackathon constraint:

- `message_rate` can stay `0` in the first cohort implementation and be introduced only when delayed customer messages are actually added

### Initial Cohort Set

Use eight cohorts for the first build. This is enough variety to create meaningful pricing, positioning, and quality tradeoffs without overdesigning the world.

- `budget_decor_browsers` (`base_share: 0.16`): printable wall art and wallpapers; prefers minimalist, neutral, and floral looks; `price_sensitivity: 0.90`; `quality_sensitivity: 0.45`; `review_reliance: 0.60`; `trend_response: 0.25`; `browse_depth: 4`; `favorite_rate: 0.18`; `review_rate: 0.15`
- `trend_aesthetic_shoppers` (`base_share: 0.14`): stickers, wallpapers, and wall art tied to active trend tags; likes retro, kawaii, celestial, and cottagecore looks; `price_sensitivity: 0.55`; `quality_sensitivity: 0.40`; `review_reliance: 0.35`; `trend_response: 1.00`; `browse_depth: 8`; `favorite_rate: 0.34`; `review_rate: 0.10`
- `planner_pragmatists` (`base_share: 0.13`): digital planners and organization products; prefers clean, functional, study, and work-related descriptors; `price_sensitivity: 0.45`; `quality_sensitivity: 0.85`; `review_reliance: 0.80`; `trend_response: 0.15`; `browse_depth: 5`; `favorite_rate: 0.10`; `review_rate: 0.28`
- `quality_first_decorators` (`base_share: 0.12`): printable wall art buyers who care about polish, print clarity, and cohesive sets; `price_sensitivity: 0.30`; `quality_sensitivity: 0.90`; `review_reliance: 0.75`; `trend_response: 0.30`; `browse_depth: 6`; `favorite_rate: 0.16`; `review_rate: 0.32`
- `bundle_value_seekers` (`base_share: 0.12`): cross-category buyers who over-index on pack, set, and bundle language; `price_sensitivity: 0.75`; `quality_sensitivity: 0.55`; `review_reliance: 0.55`; `trend_response: 0.45`; `browse_depth: 7`; `favorite_rate: 0.30`; `review_rate: 0.18`
- `niche_fandom_collectors` (`base_share: 0.11`): narrow-subject buyers for themes like cats, mushrooms, fantasy, or celestial niches; `price_sensitivity: 0.25`; `quality_sensitivity: 0.75`; `review_reliance: 0.50`; `trend_response: 0.40`; `browse_depth: 9`; `favorite_rate: 0.38`; `review_rate: 0.30`; `repeat_purchase_affinity: 0.70`
- `impulse_microtreat_buyers` (`base_share: 0.12`): low-price wallpaper and sticker buyers who purchase when fit is instantly obvious; `price_sensitivity: 0.85`; `quality_sensitivity: 0.25`; `review_reliance: 0.20`; `trend_response: 0.65`; `browse_depth: 3`; `favorite_rate: 0.06`; `review_rate: 0.05`
- `reliability_seekers` (`base_share: 0.10`): buyers across all digital-first categories who filter hard on shop trust and review quality; `price_sensitivity: 0.40`; `quality_sensitivity: 0.70`; `review_reliance: 0.95`; `trend_response: 0.10`; `browse_depth: 4`; `favorite_rate: 0.12`; `review_rate: 0.22`; `negative_review_bias: 0.70`

### Hidden vs Seller-Visible State

Hidden System 2 state:

- the cohort definitions above
- daily buyer-session allocation by cohort
- session budgets, intent tags, and purchase thresholds
- per-listing cohort compatibility scores
- pending review and message queues
- satisfaction values used to determine whether a post-purchase review is positive, neutral, or negative

Seller-visible state:

- search ranking outcomes and listing placement
- listing-level views and favorites once those metrics exist
- orders, payments, and reviews after the world resolves them
- aggregate market snapshot and trend signals
- occasional customer-facing text only after the world has already decided that a review or message exists

Control/operator-visible only:

- cohort mix for the day
- per-cohort demand totals
- hidden attribution for why a listing won or lost demand

Raw cohort IDs should stay out of the seller-facing API. They belong in System 2 and any operator/debug views, not `seller_core`.

### Recommended First Implementation Shape

Keep the first implementation small:

- define the cohort catalog as static System 2 config, not as seller-editable state
- generate buyer sessions inside `advanceDay` and treat them as ephemeral unless a debug trace needs them
- persist only the delayed outcome queues that must survive across days, starting with pending payments and reviews and leaving a clear hook for later buyer-message delivery
- add seller-visible listing metrics only where they support the loop directly, starting with views and favorites
- expose any cohort breakdown only through control/operator surfaces, not seller-facing endpoints
- do not add a standalone customer database table for hackathon scope unless delayed outcomes become hard to inspect without it

## Demand Model

Keep the first version formula-driven.

Factors:

- base traffic per category
- trend multiplier
- tag/title relevance
- price competitiveness
- listing quality score
- shop reputation score
- cohort-to-listing fit
- browse depth and drop-off

Purchase outcomes should be probabilistic, but based on deterministic features.

### How Cohorts Affect Discoverability

For each daily buyer session:

- choose an `intent_base_type`, `intent_taxonomy_id`, and a small tag set from cohort preferences, optionally nudged by active trends
- start from the existing marketplace `ranking_score`
- scale that ranking by taxonomy/tag fit, cohort `trend_response`, and whether the listing price is even plausible for the cohort to click on
- allow higher `browse_depth` cohorts to consider more search results before dropping off

This means the current transparent ranking model remains the backbone of discoverability, while cohorts change who actually notices which listings.

### How Cohorts Affect Conversion

Once a listing is viewed, conversion should depend on:

- preference fit between the cohort intent and the listing metadata
- price fit relative to `target_price`, `price_ceiling`, and `price_sensitivity`
- listing quality weighted by `quality_sensitivity`
- shop reputation and review average weighted by `review_reliance`
- trend lift weighted by `trend_response`

If fit is strong but purchase score stays slightly below threshold, the session should favorite the listing instead of ordering it when the cohort's `favorite_rate` triggers.

### How Cohorts Affect Reviews

After an order:

- create a hidden pending-review record due `1-3` simulated days later
- derive `satisfaction_score` from the same factors that produced the purchase plus a small world-owned noise term
- use `review_rate` as the baseline chance of a review
- let `negative_review_bias` increase the chance that disappointment produces a review
- generate the numeric rating from the satisfaction gap first, then optionally render text later

This keeps reviews downstream from purchases instead of turning them into immediate or arbitrary seller feedback.

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
2. inspectable buyer demand resolution for active listings
3. listing-level views, favorites, and purchases
4. due payment/review delivery from prior queued events
5. optional DM/event generation later
6. shop-level daily summary creation

System 2 should own this process. System 3 consumes the resulting world state; it should not define the simulation rules themselves.

## First Advance-Day Pipeline

The first implementation should stay simple as long as the steps are explicit and inspectable.

Current implementation:

1. resolve the just-finished day for currently active listings
2. add deterministic-ish views and favorites from transparent demand formulas
3. create orders when view and conversion thresholds are met
4. create pending payment/review events from those orders
5. settle any queued events now due on the new day
6. advance the world clock by one day
7. refresh deterministic trend state
8. rebuild the market snapshot from the updated marketplace state

Current implementation note:

- `server/src/simulation/day-resolution.ts` now owns the first real System 2 consequence pipeline
- active listings are grouped by taxonomy and resolved with explicit quality, reputation, price, freshness, trend, and small deterministic-variation factors
- the first pass is intentionally formula-driven and session-free: it does not use LLMs and it does not yet persist full buyer-session traces
- `advanceDay` now returns inspectable steps plus a `last_day_resolution` summary and `pending_events` queue through the control/world-state surfaces
- delayed payment posting and delayed review creation are live; buyer-message delivery still uses the same pending-event hook but is not yet materialized into seller-visible state

Recommended default for the first build:

- keep formulas simple and visible in code
- favor deterministic trend rotation over opaque randomness
- do not require rich multi-business competition yet
- let later milestones deepen this into explicit cohort/session resolution without changing the System 2 ownership boundary or the control/runtime surface

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

## LLM Use Policy

Allowed:

- optional review-text rendering after rating and sentiment are already determined by structured simulation
- optional customer-message rendering after System 2 has already decided that a message exists and what it is about
- optional operator-facing summaries that explain cohort outcomes using already-computed state

Not allowed:

- deciding which cohort is active for a session
- deciding discoverability, favorites, purchases, ratings, or delays
- replacing deterministic ranking, listing-quality scoring, or reputation effects with freeform model judgment
- mutating hidden customer state based only on model-written narrative

Default implementation guidance:

- start with templates for review text and no customer messages
- add LLM-written flavor only if the structured simulation is already stable and the generated text cannot change business outcomes

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
