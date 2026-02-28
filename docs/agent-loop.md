# Agent Loop

## Purpose

Define the VendingBench-style operating loop for Botique's shop-owner agents.

The AI should act as a business operator inside the environment, not as a narrator outside it.

Status: `Current decision` on the overall framing. Exact loop details below are mostly `Recommended default`.

## Loop Design Rules

- keep the business objective explicit
- keep tool descriptions stable across runs
- let the environment own outcomes and timing
- prefer simple inspectable memory over hidden retrieval
- make day boundaries and end-of-day transitions explicit

Status: `Recommended default`

## Main Loop

Per simulated day:

1. simulation resolves overnight outcomes
2. orchestrator generates a morning briefing
3. agent receives the briefing plus available tools
4. agent takes up to `N` turns
5. each turn allows at most one tool call
6. agent may end the day early
7. logs and notes persist into the next day

Status: `Recommended default`

Boundary note:

- System 3 should consume `current_day`, `market_snapshot`, `trend_state`, and `advanceDay` outputs from System 2.
- System 1 remains the seller-facing API surface; it should not become the owner of day advancement logic.

## Morning Briefing

The briefing should be compact, structured, and unambiguous.

Suggested sections:

- cash and balance summary
- yesterday's orders and revenue
- listing performance changes
- new reviews
- new customer messages
- reminders due today
- notable market movement
- current standing against the main business objective
- prompt to choose priorities for the day

Status: `Recommended default`

Current implementation in `src/agent_runtime/briefing.py` models the briefing with explicit sections for:

- balance summary
- yesterday order summary
- listing performance deltas
- new reviews
- new customer messages
- reminders due today
- market movements
- primary objective progress
- operator/runtime notes
- a stable priorities prompt

The initial implementation also includes a small `MorningBriefingBuilder` that pulls due reminders from the simple reminder store so the loop can stay inspectable.

The runtime now also includes a live Botique briefing path:

- read seller-facing shop, listing, order, review, and payment state through `seller_core`
- read `current_day`, `market_snapshot`, and `trend_state` through the separate control API
- derive compact briefing sections from that live state instead of requiring fully hand-authored JSON
- compare against the prior captured shop snapshot during multi-day runs so listing deltas stay inspectable

## Turn Rules

- one tool call per turn
- bounded number of turns per day
- stable tool descriptions
- explicit day-ending action
- no hidden control-plane powers

Status: `Recommended default`

Current implementation in `src/agent_runtime/loop.py` uses a `SingleShopDailyLoop` with:

- one `AgentTurnDecision` per turn
- either exactly one tool call or an explicit end-day action
- a configurable max-turn cap
- structured day/turn/tool events for debugging and demo playback
- no delegation or sub-agent assumptions

Current runtime note:

- the owner-agent runtime binds the current `shop_id` from the morning briefing into shop-scoped tool calls so the model cannot switch shops by inventing a different seller id mid-run

Current runtime entrypoint:

- `botique-agent-runtime run-day --briefing-file <path>`
- `botique-agent-runtime run-day --shop-id <shop_id>`
- `botique-agent-runtime run-days --shop-id <shop_id> --days <n>`
- the CLI can still load a structured briefing directly, but the main reference-run path is now `run-days`, which builds each morning briefing from live Botique state, executes the agent day, advances the simulation between days, and persists an inspectable artifact bundle for the run
- the default provider wiring is Mistral through `MISTRAL_API_KEY` and optional `BOTIQUE_MISTRAL_*` settings, but the loop itself remains provider-agnostic
- live runs accept `--output-dir`; if omitted, artifacts are written under `artifacts/agent-runtime/<timestamp>__shop-...__<run_id>`

Documented example command:

```bash
BOTIQUE_CORE_BASE_URL=http://localhost:3000/v3/application \
MISTRAL_API_KEY=your-key \
botique-agent-runtime run-days \
  --shop-id 1001 \
  --days 5 \
  --run-id reference_baseline_01 \
  --max-turns 6 \
  --output-dir artifacts/agent-runtime/reference-baseline-01 \
  --pretty
```

Notes:

- `BOTIQUE_CONTROL_BASE_URL` is optional if the control surface lives next to the seller API; the runtime will derive `/control` from `BOTIQUE_CORE_BASE_URL`
- the JSON stdout payload now includes an `artifacts` object with the resolved output paths for the run summary and bundle root

## Core Cognitive Stages

The prompt should encourage these modes without over-hardcoding them:

- sense
- evaluate
- strategize
- act
- reflect

## Notes and Reminders

Use simple memory only.

Recommended tools:

- `write_note`
- `read_notes`
- `set_reminder`
- `complete_reminder`

This keeps the strategy legible and avoids complex retrieval systems during the hackathon.

The goal is not sophisticated recall. The goal is to let the agent persist explicit plans, follow-ups, and lessons in a way judges and developers can inspect.

Current implementation in `src/agent_runtime/memory.py` is an in-memory placeholder store. It is intentionally simple and suitable for a single-shop run before adding persistence or retrieval layers.

## Delegation

Not required for the first successful run.

If added later:

- the owner agent decides when to delegate
- delegated agents get restricted tools
- delegation has a simulated cost
- returned work should be structured and inspectable

Status: `Recommended default`

## Logging

Every day and every turn should log:

- briefing content
- model response
- tool name and arguments
- tool result
- resulting state changes
- any note or reminder writes

Logs are part of the product. They make strategy visible to judges and to you while debugging.

Current implementation in `src/agent_runtime/events.py` and `src/agent_runtime/loop.py` emits structured events for:

- day start and end
- briefing generation
- turn start
- model response
- tool call, result, and failure
- note writes
- reminder creation

The multi-day runner now keeps the surrounding run structure inspectable too:

- pre-day shop snapshots used to build the briefing
- post-day shop snapshots after the agent acts
- control-plane day advancement records between daily runs
- run-level note and reminder snapshots alongside the per-turn event stream

Reference-run artifact layout:

```text
<output-dir>/
  README.md
  manifest.json
  summary.md
  summary.json
  result.json
  events.jsonl
  memory/
    notes.json
    reminders.json
  days/
    day-0003/
      briefing.json
      briefing.md
      summary.md
      turns.json
      events.jsonl
      record.json
      market_state_before.json
      state_before.json
      state_after.json
      advancement.json
```

How to read it:

- `summary.md` is the fastest human pass over a run
- `summary.json` is the comparison-friendly aggregate view across runs
- `result.json` keeps the full serialized runtime result if you want the entire object graph in one file
- `days/day-####/briefing.md` shows exactly what the model saw each morning
- `days/day-####/summary.md` shows each turn decision with tool arguments and tool results
- `events.jsonl` and `days/day-####/events.jsonl` keep the raw event stream for replay or diffing
- `advancement.json` captures the explicit control-plane day advance record between days

## Failure Modes To Guard Against

- repetitive tool loops
- failure to end the day
- reacting to stale information
- overuse of extension tools instead of marketplace evidence
- ambiguous timing around when orders, reviews, or delegated work appear
- overfitting to narrative events while ignoring business metrics
