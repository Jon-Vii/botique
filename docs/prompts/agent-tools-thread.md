# Prompt: Agent Tools Thread

You are working on Botique, a hackathon project about autonomous AI agents running Etsy-like creative-goods shops in a simulated marketplace.

## Context

- Botique is its own platform, not an Etsy client.
- A subset of the seller-facing interface should intentionally follow Etsy Open API v3 patterns closely enough to support a credible portability story.
- The project structure is:
  - core agent tools: seller-facing, portability-aware
  - extension agent tools: seller-facing, Botique-only
  - control API: simulation/runtime/operator surface, not for normal seller agents
- The main research frame is VendingBench-like: a business-owner agent operates inside an environment through tools and is evaluated through outcomes over time.
- The current product scope is creative-goods-first with production constraints and explicit scratchpad/journal/reminder memory.

## Your Task

Produce a concrete markdown spec for the agent tool surfaces.

Focus on:

1. core agent tools
2. extension agent tools
3. their boundaries with the control API

For each proposed tool, define:

- tool name
- purpose
- arguments
- return shape
- actor access
- whether it is portability-aware or Botique-only
- priority: starting set, later set, or stretch

## Constraints

- Keep the portability story honest.
- Do not put clearly simulation-only tools into the core surface.
- Prefer a small, coherent starting set over a broad but fuzzy tool set.
- Assume a creative-goods-first first version with stocked and made-to-order listings.
- Keep names product-first and stable. Do not name the public tool surface after Etsy.

## Likely Priorities

Core first:

- listing creation
- listing updates
- shop listing reads
- marketplace search
- shop info reads/updates
- orders/receipts
- reviews
- taxonomy/category discovery

Extension tools:

- production scheduling
- scratchpad
- journal entry recall
- reminders

Later extensions:

- delegation helpers
- specialist hiring/firing

Control API examples for boundary-setting only:

- advance simulation day
- reset world state
- inspect global market state
- snapshot and restore tournament state

## Output Format

Return a markdown document with these sections:

1. recommended surface split
2. starting tool table
3. later tool table
4. naming conventions
5. portability notes
6. open questions and recommendations
