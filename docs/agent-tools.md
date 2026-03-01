# Agent Tools

## Purpose

This document describes the seller-facing tools exposed to AI agents in the Botique runtime.

Two tool categories exist:

1. **Core seller tools**: portable seller operations (listing management, search, orders, reviews)
2. **Botique extensions**: simulation-specific seller tools (production scheduling, memory surfaces)

The runtime/control surface is separate and not part of the shop-owner tool set.

## Design Rules

- Tool descriptions explain business consequences, not just API shape
- Draft versus active listing behavior stays explicit
- `stocked` and `made_to_order` are separate seller choices backed by one shared production system
- Production is seller-visible business state, not control-plane state

## Core Seller Surface

Portable seller operations:

- `create_draft_listing` — prepare a new offer without entering the market
- `update_listing` — activate, pause, reprice, retag, or change a listing
- `delete_listing` — remove a listing
- `search_marketplace` — search the marketplace

## Botique Production Extensions

Simulation-specific seller tools:

- `queue_production` — schedule future stock production for a stocked listing
- `get_capacity_status` — inspect shop production queue and backlog pressure

These represent ordinary owner actions inside the simulated business — they do not advance time or reveal hidden world state.

## Runtime Summary Tools

Composed summaries over seller-visible state:

- `get_shop_dashboard` — cash, listing counts, production pressure, recent orders/reviews, and alerts
- `get_listing_details` — listing economics, fulfillment mode, stock/backlog, queued production, and recent reviews

These reduce bookkeeping overhead rather than automating business decisions.

## Memory Tools

One coherent memory system with three underlying semantics:

- **Scratchpad**: one mutable current text block per shop/run, revised at end-of-day
- **Journal entries**: append-only log items via `add_journal_entry` / `read_journal_entries`
- **Reminders**: scheduled resurfacing via `set_reminder` / `complete_reminder`

The scratchpad is intentionally freeform and model-authored. Due reminders and a small recent journal slice are injected into each morning briefing. Full journal history is available on demand.

## Production Semantics

The agent tool surface reflects these business truths:

- `draft` listings do not sell; `active` listings do
- `stocked` listings sell from finished inventory on hand
- `made_to_order` listings sell from future shared capacity and create backlog
- `queue_production` queues future work — it does not create inventory instantly
- Queued work competes with existing backlog for the same shared daily capacity

For agent-managed shops, stocked replenishment is an explicit seller decision. Background NPC shops may use a baseline stocking policy.

## Default Owner-Agent Surface

The default tool set exposed to the owner agent is intentionally narrower than the full seller API:

**Summary tools**: `get_shop_dashboard`, `get_listing_details`

**Action tools**: `create_draft_listing`, `update_listing`, `delete_listing`, `search_marketplace`, `queue_production`

**Memory tools**: `add_journal_entry`, `read_journal_entries`, `set_reminder`, `complete_reminder`

The owner agent should not need to spend half its day rebuilding a dashboard from low-level reads.
