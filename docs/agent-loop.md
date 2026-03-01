# Agent Loop

## Purpose

The Botique shop-owner runtime is a constrained seller workday with explicit memory and inspectable artifacts.

The agent should feel like a business operator spending a limited day on meaningful work inside the environment.

## Loop Design Rules

- Keep the business objective explicit
- Let the environment own outcomes, timing, and day settlement
- One available action per work slot
- Visible daily work-slot limit instead of hidden action shaping
- Same-day context stays intact inside one workday window
- Cross-day memory is explicit and inspectable through scratchpad, journal, and reminders
- Avoid provider-specific hacks or hidden reasoning dependencies

## Main Loop

Per simulated day:

1. System 2 resolves overnight outcomes
2. System 3 generates a morning briefing from seller-visible state
3. The agent receives the briefing plus the allowed tool surface
4. The agent spends up to N work slots (each allows exactly one action)
5. The agent may end the day early
6. The runtime settles the day
7. The runtime revises the scratchpad at end of day for the next morning
8. Logs, scratchpad state, journal entries, reminders, and artifacts persist

System 3 consumes seller-facing state. It does not own simulation settlement rules.

## Workday Model

The day starts with a finite number of work slots. Each slot allows exactly one action. All ordinary actions consume one slot. `end_day` stops early.

Journal, reminders, and scratchpad stay available during the day. Scratchpad revision happens in the end-of-day phase rather than spending a daytime work slot.

## Morning Brief

The agent receives a natural seller brief — not runtime JSON to parse.

Sections include:

- Date and shop header
- Primary objective and current business status
- Cash position (available and pending)
- Yesterday's orders and revenue
- Listing movement worth noticing
- New reviews or customer messages
- Current scratchpad text (when non-empty)
- Recent journal slice
- Reminders due today
- Market watch items
- Short instruction to choose the highest-leverage work

## Same-Day Context

The workday behaves like one continuous operating session:

- Exact same-day action arguments and tool results stay in-context across work slots
- The runtime does not compress or rewrite the same-day working set
- Cross-day context resets to a fresh morning brief plus explicit memory surfaces

## End-Of-Day Memory

At the end of each day, the runtime asks the model to revise the persistent scratchpad. This:

- Does not consume a daytime work slot
- Is freeform rather than template-driven
- Produces an inspectable longitudinal memory trace in artifacts

## Tournament Mode Note

Tournament mode is an additive runtime mode, not a replacement for the single-shop baseline.

The single-shop run remains the cleanest place to inspect traces, refine tool ergonomics, understand memory behavior, and compare runs. Tournament mode exists for richer demo behavior and multi-entrant comparison.

See the Tournament Mode doc for the tournament-specific contract.
