# Agent Tool Surfaces

## Purpose

This document defines the seller-facing tools exposed to AI agents and keeps the portability story disciplined.

Two agent-facing seller surfaces exist:

1. `seller_core`: portability-aware seller tools, Etsy-compatible in spirit
2. Botique seller extensions: seller-visible Botique tools that reflect simulation-specific business mechanics

The runtime/control surface is separate and is not part of the normal shop-owner tool set.

Status: `Current decision` on the surface split. Tool membership below is now partly `Current decision`.

## Design Rules

- tool descriptions should explain business consequences, not just HTTP shape
- draft versus active behavior must stay explicit
- `stocked` and `made_to_order` stay separate seller choices
- both fulfillment modes still run on one shared production system underneath
- production is seller-visible business state, not control-plane state
- Botique-only production tools must not be presented as portable Etsy-like core tools

## Core Seller Surface

These are the portability-aware seller operations kept in `seller_core`.

Current core surface:

- `create_draft_listing`
- `update_listing`
- `delete_listing`
- `get_listing`
- `get_shop_listings`
- `search_marketplace`
- `get_listing_inventory`
- `update_listing_inventory`
- `get_shop_info`
- `update_shop`
- `get_orders`
- `get_order_details`
- `get_payments`
- `get_reviews`
- `get_taxonomy_nodes`

Status: `Current decision` on keeping this as the portable surface.

Boundary note:

- `seller_core` may still include low-level compatibility operations such as `update_listing_inventory`
- that does not mean those tools are good default tools for the owner-agent
- the default owner-agent set should be narrower and more truthful to Botique's business physics

## Botique Seller Extensions

These are still seller-facing tools, but they are Botique-specific and not part of the portability claim.

Current v1 production extensions:

- `queue_production`
- `get_capacity_status`

Status: `Current decision` for the initial production-aware owner-agent surface.

These are seller-facing because they represent ordinary owner actions inside the simulated business:

- deciding to schedule more future stocked output
- inspecting shared shop capacity and queue pressure

They are not control-plane actions:

- they do not advance time
- they do not bypass queue physics
- they do not reveal hidden global state

## Production Semantics

The owner-agent tool surface must reflect these business truths:

- `draft` listings do not sell
- `active` listings do
- `stocked` listings sell from finished inventory on hand
- `made_to_order` listings sell from future shared capacity and create backlog

Operational interpretation:

- `create_draft_listing` is the safe way to prepare an offer before it affects revenue
- `update_listing(state="active")` is the moment a listing becomes eligible to sell
- `queue_production(listing_id, units)` adds future stock work for a stocked listing
- made-to-order listings do not need a manual "restock" action; sales automatically create customer-order production jobs in the shared queue

Important simulation split:

- for agent-managed shops, stocked replenishment is an explicit seller decision through `queue_production`
- background NPC shops may still use a baseline stocking policy so the surrounding market does not go inert when no agent controls them

This is the core semantic shift for v1:

- do not describe the system as "restocking"
- describe it as production scheduling against shared capacity

## Default Owner-Agent Surface

The default seller-facing tools exposed to the owner agent should now be:

Runtime-composed summary tools:

- `get_shop_dashboard`
- `get_listing_details`

Direct seller tools:

- `create_draft_listing`
- `update_listing`
- `delete_listing`
- `search_marketplace`
- `queue_production`

Botique support tools still remain:

- `add_journal_entry`
- `read_journal_entries`
- `set_reminder`
- `complete_reminder`

Status: `Current decision` for the owner-agent default set.

The important distinction is:

- `seller_core` stays broad and canonical
- the default owner-agent runtime surface is narrower and more decision-oriented

The owner agent should not need to spend half its day rebuilding a dashboard from low-level reads.

## Runtime Summary Tools

These tools are not added to `seller_core`. They are runtime-composed summaries over ordinary seller-visible state.

Current runtime summary tools:

- `get_shop_dashboard`
- `get_listing_details`

Boundary rules:

- they aggregate only seller-visible state
- they do not reveal hidden world state
- they do not embed strategy or choose actions for the agent
- they reduce bookkeeping width rather than automating business decisions

`get_shop_dashboard` should replace most day-opening low-level reads by summarizing:

- posted and pending cash signals
- active versus draft listing counts
- production capacity and backlog pressure
- recent order and review signals
- short listing rows for the most relevant listings
- alerts such as low stock, queue pressure, or inactive inventory

`get_listing_details` should replace generic listing inspection by focusing on:

- listing economics
- fulfillment mode
- finished stock or backlog
- queued production
- recent review signals

## Memory Tools

Botique now exposes one coherent memory system with three underlying semantics:

- `scratchpad`: one mutable current text block per shop/run
- `journal entries`: append-only journal/log items
- `reminders`: scheduled resurfacing

Default owner-agent memory tools:

- `add_journal_entry`
- `read_journal_entries`
- `set_reminder`
- `complete_reminder`

Memory rules:

- the scratchpad is intentionally freeform and model-authored
- the scratchpad is revised in the end-of-day phase rather than through the normal daytime owner-agent tool surface
- `add_journal_entry` appends one inspectable journal entry without rewriting prior entries
- `read_journal_entries` stays simple and bounded with `limit`, optional `tag`, and optional `since_day`
- reminders remain push-style resurfacing rather than hidden retrieval

Boundary rules:

- do not auto-copy raw external content or tool payloads into the scratchpad
- do inject the current scratchpad text, due reminders, and only a small recent journal slice into the morning briefing
- do not inject the full journal every morning
- keep the scratchpad seller-visible and inspectable in artifacts

## Tools Not Exposed By Default

These tools still exist, but they are not part of the default owner-agent workday surface:

- `update_shop`
- `get_shop_info`
- `get_shop_listings`
- `get_orders`
- `get_order_details`
- `get_reviews`
- `get_capacity_status`
- `get_listing_inventory`
- `update_listing_inventory`
- `get_payments`
- `get_taxonomy_nodes`

Rationale:

- `update_shop` mostly changes storefront copy and messaging, not the production-constrained business loop
- the default owner-agent should not need multiple low-level read calls just to understand today’s shop state
- low-level inventory document tools are compatibility surfaces and are easier for the model to misuse than production-aware tools
- `get_payments` is useful for briefing assembly and reporting, but it is less action-driving than orders, listings, reviews, and capacity state during a bounded workday
- taxonomy browsing remains useful, but it is not necessary on every workday and is hidden by default until the listing-creation flow clearly needs it

## Tool Notes

### `create_draft_listing`

Use when the agent wants to introduce a new offer without immediately entering the market.

Important semantics:

- the listing starts non-selling unless later activated
- fulfillment mode is a real economic choice, not a cosmetic field
- stocked listings should only claim finished units the shop actually has on hand

### `update_listing`

Use when the agent wants to activate, pause, reprice, retag, or otherwise change a listing.

Important semantics:

- activating a listing changes expected business outcomes immediately
- changing `capacity_units_per_item`, `material_cost_per_unit`, or `lead_time_days` changes production economics
- changing fulfillment mode changes how future demand resolves

### `queue_production`

Use when the agent wants more future stock for a stocked listing.

Important semantics:

- it queues future work; it does not create inventory instantly
- queued work competes with existing backlog for the same shared daily capacity
- in v1 this is intentionally for stocked listings
- made-to-order demand creates production jobs automatically when orders arrive

### `get_capacity_status`

Use when the agent needs to understand whether the shop can support more active stocked listings or whether backlog pressure is already high.

Important semantics:

- this is seller-visible shop state
- it exposes queue depth, backlog, and per-listing queued work
- it is not hidden control-plane state

## Rationale For Recent Changes

Added:

- `queue_production` so the agent can express a real production decision instead of faking supply through inventory semantics
- `get_capacity_status` so the agent can inspect queue pressure before activating listings or scheduling more work
- `get_shop_dashboard` and `get_listing_details` so the owner agent can reason from compact seller-visible summaries instead of spending turns on low-level bookkeeping

Removed from the default owner-agent set:

- `update_shop`, because v1 should emphasize business mechanics over storefront copy editing
- `get_shop_info`
- `get_shop_listings`
- `get_orders`
- `get_order_details`
- `get_reviews`
- `get_capacity_status`
- `get_taxonomy_nodes`

Demoted from preferred owner-agent usage:

- `get_listing_inventory`
- `update_listing_inventory`

Reason:

- they are still valid compatibility tools
- they are not the clearest way to model Botique's production-constrained world

## Naming Guidance

Public tool names should stay stable and readable:

- snake_case names
- product-first naming
- explicit verbs
- no `etsy_*` public prefixes

Internal compatibility mapping may still preserve Etsy operation names for portable core calls.

## Portability Rules

Portable enough for `seller_core`:

- listing creation and edits
- listing reads and search
- shop reads
- order reads
- review reads
- taxonomy discovery
- compatibility inventory reads and writes

Botique-only seller extensions:

- production queue inspection
- production scheduling
- scratchpad, journal, and reminders
- trend summaries or other simulation-rich seller aids

Not seller-facing:

- `advance_day`
- `inject_event`
- `get_global_market_state`
- `start_run`
- `pause_run`
- `reset_run`

Those remain in `control_api`.

## Current Implementation Note

Current code now reflects this split:

- `src/seller_core/compat/etsy_v3.py` carries the portable core tool metadata
- `src/seller_core/compat/botique.py` carries Botique-only seller production tools
- `src/agent_runtime/tools/core.py` exposes the smaller production-aware default owner-agent set
- the Fastify seller API exposes small seller-facing production endpoints without mixing in control-plane behavior

## Core CLI Contract

The reusable CLI deliverable remains the portable core client/CLI package.

It should:

- expose stable seller-facing tool names
- compile core tool calls into HTTP requests through compatibility mappings
- allow the runtime to inspect richer seller tool manifests, including Botique extensions, when needed

It should not:

- own simulation state
- perform control-plane actions
- hide production physics behind fake immediate inventory updates
