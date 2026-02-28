# Agent Tool Surfaces

## Purpose

This document defines the tool surfaces exposed to AI agents and keeps the portability story disciplined.

Two agent-facing surfaces exist:

1. Core agent tools: portability-aware, seller-facing, Etsy-compatible in spirit
2. Extension agent tools: seller-facing, Botique-only

The runtime/control surface is separate and not agent-facing for normal shop agents.

Status: `Current decision` for the surface split. Tool membership below is partly `Recommended default`.

## Surface Overview

### Core Agent Tools

These should be the default tools for the shop-owner agent.

Principles:

- model them after Etsy seller operations
- keep naming clear and product-first
- internally preserve the mapping to Etsy operation names
- avoid simulation-only convenience tools here

Current core surface in `seller_core`:

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

The exact build priority within this surface is still a planning decision.

Status: `Recommended default`

## Recommended Core Matrix

Use the portable core surface for the seller actions that are both believable for a shop owner and likely to exist across providers.

`Starting priority` for the first believable seller loop:

- `create_draft_listing`
- `update_listing`
- `delete_listing`
- `get_listing`
- `get_shop_listings`
- `search_marketplace`
- `get_shop_info`
- `update_shop`
- `get_orders`
- `get_order_details`
- `get_reviews`
- `get_taxonomy_nodes`

`Additional compatible tools already modeled in seller_core`:

- `get_listing_inventory`
- `update_listing_inventory`
- `get_payments`

`Likely Botique extensions`, not portable core:

- `write_note`
- `read_notes`
- `set_reminder`
- `get_balance`
- `get_marketplace_trends`
- simulated customer scenario tools

`Defer unless product scope expands`:

- shipping management and fulfillment writes for physical goods
- media upload flows that require binary asset handling
- broad payments or ledger-reporting surfaces beyond basic shop visibility

### Extension Agent Tools

These are optional tools for research and richer Botique behavior.

Suggested starting extension set:

- `write_note`
- `read_notes`
- `set_reminder`
- `get_balance`
- `get_marketplace_trends`

Possible later additions:

- `hire_agent`
- `fire_agent`
- `delegate_task`

Status: `Recommended default`

Current scaffold in `src/agent_runtime/tools/` does two things:

- wraps the initial owner-agent `seller_core` subset through a runtime registry
- adds simple Botique extension tools for `write_note`, `read_notes`, and `set_reminder`

The current runtime intentionally does not expose delegation helpers, balance/trend shortcuts, or control-plane operations to the shop owner agent.

## Control API

This is not part of the normal agent tool surface.

Suggested responsibilities:

- `advance_day`
- `inject_event`
- `get_global_market_state`
- `seed_customers`
- `seed_shops`
- `start_run`
- `pause_run`
- `reset_run`

Used by:

- simulation runner
- backend orchestration code
- operator tooling
- frontend dashboard

Status: `Current decision` on separation, `Recommended default` on exact endpoints

## Naming Guidance

Public tool names should stay stable and readable:

- snake_case names for tool calls
- product-first naming, not `etsy_*`
- explicit action names, not overloaded generic verbs

Internal compatibility mapping can preserve canonical Etsy operation names:

- `create_draft_listing -> createDraftListing`
- `update_listing -> updateListing`
- `get_shop_listings -> getListingsByShop`
- `search_marketplace -> findAllListingsActive`

## Portability Rules

Portable enough for the core surface:

- listing creation and updates
- shop data reads and updates
- seller order/receipt reads
- review reads
- taxonomy/category discovery

Botique-only:

- trend summaries
- notes and reminders
- delegation controls
- global competitor summaries unavailable to a real seller
- any simulation control or hidden-state access

## Recommended Folder Layout

```text
src/
  seller_core/
    client.py
    cli.py
    models.py
    transport.py
    compat/
      etsy_v3.py
  botique_extensions/
    ...
  agent_runtime/
    tools/
      core.py
      extensions.py
  control_api.py
```

Status: `Recommended default`

Current scaffold now exists at:

```text
src/
  agent_runtime/
    briefing.py
    events.py
    loop.py
    memory.py
    tools/
      core.py
      extensions.py
      registry.py
```

## Core CLI Contract

The reusable core deliverable should be a client and CLI package, not the future Botique runtime tool registry.

It should:

- expose stable seller-facing tool names
- compile those tool calls into HTTP requests through an internal Etsy v3 compatibility map
- keep transport configurable so the same tool surface can target Etsy or Botique System 1

It should not:

- embed marketplace state
- simulate backend behavior
- own persistence or business logic

Recommended CLI shape:

- `botique-agent-tools-core manifest`
- `botique-agent-tools-core prepare <tool_name> --args '{...}'`
- `botique-agent-tools-core call <tool_name> --args '{...}'`

Recommended runtime config:

- `BOTIQUE_CORE_BASE_URL`
- `BOTIQUE_CORE_API_KEY`
- `BOTIQUE_CORE_BEARER_TOKEN`

Default compatibility target can be Etsy Open API v3, but the public tool names stay product-first.

Implementation note:

- `seller_core` is the reusable implementation package
- `agent_runtime/tools/` is a separate concern and should expose whichever subset of core and extension tools a given agent role is allowed to use

Status: `Current decision` for keeping the core CLI transport-only, `Recommended default` for the exact command names and package split

## Outstanding Questions

- whether `get_balance` belongs in core or extensions
- whether trend access should be direct or inferred from marketplace browsing
- whether order details should be part of the earliest end-to-end loop or follow immediately after
- whether media upload belongs in the initial digital-first build
