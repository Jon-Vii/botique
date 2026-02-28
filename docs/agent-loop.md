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
6. runtime settles the day automatically
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
- runtime-owned day ending
- no hidden control-plane powers

Status: `Recommended default`

Current implementation in `src/agent_runtime/loop.py` uses a `SingleShopDailyLoop` with:

- one `AgentTurnDecision` per turn
- bounded inspect turns before an act-or-`no_action` decision is required
- automatic day settlement after the first primary business action
- a configurable max-turn cap with a default `3`-turn loop
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
  --max-turns 3 \
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

## Agent Loop V1 Patch Plan

This section is the concrete near-term runtime plan for getting from a technically working loop to a believable shop-operator loop.

Status: `Current decision` for implementation direction

### Why change the loop

The first live smoke run showed a predictable failure mode:

- repeated low-risk `search_marketplace` calls
- no listing or shop changes
- no note/reminder writes
- no voluntary end-of-day decision

This suggests the current loop over-rewards inspection and makes day ending feel like an artificial seller choice.

### V1 design goal

Make the agent behave more like a seller and less like a search bot.

The loop should encourage:

- a small amount of evidence gathering
- one concrete business-changing move when warranted
- a short explicit reflection artifact
- automatic day settlement by the runtime

### V1 daily structure

Per simulated day:

1. System 2 resolves overnight outcomes
2. System 3 builds the morning briefing
3. agent gets a bounded inspect budget
4. agent gets one primary action window
5. optional note/reminder write if useful
6. runtime ends the day automatically
7. System 2 advances and produces next-day consequences

Recommended initial bounds:

- max `3` turns per day
- at most `2` inspect turns
- at most `1` primary business action

### Tool classes for V1

Treat tools as two behavioral classes even if they stay on the same exposed seller surface.

`inspect`

- `search_marketplace`
- `get_shop_info`
- `get_shop_listings`
- `get_listing`
- `get_orders`
- `get_order_details`
- `get_reviews`
- `get_taxonomy_nodes`

`act`

- `create_draft_listing`
- `update_listing`
- `delete_listing`
- `update_shop`

`memory support`

- `write_note`
- `read_notes`
- `set_reminder`
- `complete_reminder`

Memory tools should remain auxiliary. They should not become the main productive action for the day.

### V1 runtime policy

Recommended runtime contract:

- remove `end_day` as a normal strategic action for the first hackathon-quality loop
- allow repeated inspect calls only inside a small inspect budget
- after inspect budget is exhausted, require either:
  - one `act` tool call, or
  - an explicit structured `no_action` response explaining why no business change is justified today
- once the act-or-no-action window is consumed, settle the day automatically

This keeps day boundaries inspectable without making day ending itself the interesting decision.

### V1 prompt changes

The prompt should stop suggesting open-ended evidence gathering.

Add explicit guidance that:

- inspection is for deciding what to change
- repeated search without a decision is low value
- the goal is to make or justify one concrete business move per day
- notes/reminders support decisions but do not replace them

### V1 briefing changes

The morning briefing should become more action-oriented.

Add compact sections or fields for:

- strongest opportunity today
- clearest risk today
- strongest listing signal
- weakest listing signal
- whether yesterday suggests:
  - keep strategy
  - adjust strategy
  - explore a new niche

### V1 context trimming

Do not keep feeding full raw tool payloads back into subsequent turns when a summary is enough.

Near-term rule:

- keep full tool results in artifacts
- pass summarized prior tool results into the next model prompt
- especially summarize marketplace search results instead of replaying entire listing payloads

This should improve both cost and agent behavior.

### V1 implementation order

1. add tool classification inside the runtime
2. replace explicit `end_day` with inspect-budget plus act window logic
3. add structured `no_action` as the only non-tool alternative
4. tighten briefing wording and priorities prompt
5. summarize prior tool results before sending them back to the model
6. rerun the same short reference scenario on at least one stronger model

### Success criteria

The loop change is successful when a short live run usually shows:

- fewer redundant marketplace searches
- at least one concrete seller action on days where a change is justified
- inspectable reasoning through action summaries and notes
- automatic day settlement without loop confusion
- artifact bundles that remain easy to compare across runs

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
