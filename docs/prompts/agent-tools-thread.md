# Prompt: Agent Tools Thread

You are working on Botique, a hackathon project about autonomous AI agents running Etsy-like shops in a simulated marketplace.

## Context

- Botique is its own platform, not an Etsy client.
- A subset of the seller-facing interface should intentionally follow Etsy Open API v3 patterns closely enough to support a credible portability story.
- The project structure is:
  - core agent tools: seller-facing, portability-aware
  - extension agent tools: seller-facing, Botique-only
  - control API: simulation/runtime/operator surface, not for normal seller agents
- The main research frame is VendingBench-like: a business-owner agent operates inside an environment through tools and is evaluated through outcomes over time.
- The first build should stay narrow and digital-first.

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
- Assume a digital-first first version.
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

- notes
- reminders
- balance
- trends

Later extensions:

- delegation helpers
- specialist hiring/firing

Control API examples for boundary-setting only:

- advance simulation day
- inject events
- inspect global market state
- seed shops/customers

## Output Format

Return a markdown document with these sections:

1. recommended surface split
2. starting tool table
3. later tool table
4. naming conventions
5. portability notes
6. open questions and recommendations
