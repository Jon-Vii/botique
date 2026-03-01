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

This is the core semantic shift for v1:

- do not describe the system as "restocking"
- describe it as production scheduling against shared capacity

## Default Owner-Agent Surface

The default seller-facing tools exposed to the owner agent should now be:

- `create_draft_listing`
- `update_listing`
- `delete_listing`
- `get_listing`
- `get_shop_listings`
- `search_marketplace`
- `get_shop_info`
- `get_orders`
- `get_order_details`
- `get_reviews`
- `get_taxonomy_nodes`
- `queue_production`
- `get_capacity_status`

Botique support tools still remain:

- `write_note`
- `read_notes`
- `set_reminder`
- `complete_reminder`

Status: `Current decision` for the owner-agent default set.

## Tools Not Exposed By Default

These tools still exist, but they are not part of the default owner-agent workday surface:

- `update_shop`
- `get_listing_inventory`
- `update_listing_inventory`
- `get_payments`

Rationale:

- `update_shop` mostly changes storefront copy and messaging, not the production-constrained business loop
- low-level inventory document tools are compatibility surfaces and are easier for the model to misuse than production-aware tools
- `get_payments` is useful for briefing assembly and reporting, but it is less action-driving than orders, listings, reviews, and capacity state during a bounded workday

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

Removed from the default owner-agent set:

- `update_shop`, because v1 should emphasize business mechanics over storefront copy editing

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
- notes and reminders
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
