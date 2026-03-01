# Agent Loop

## Purpose

Define the Botique shop-owner loop as a constrained seller workday, not a synthetic action quota.

The AI should feel like a business operator spending a limited day on meaningful shop work inside the environment.

Status: `Current decision` on the workday framing and runtime-owned day settlement. Exact turn-slot sizing remains a `Recommended default`.

## Loop Design Rules

- keep the business objective explicit
- let the environment own outcomes, timing, and day settlement
- keep one tool call per turn
- use a visible daily turn-slot limit instead of hidden action shaping
- keep workspace and reminders available as ordinary support tools
- keep workspace memory explicit, optional, and inspectable
- prefer compact inspectable session state over orchestration-heavy payloads
- avoid provider-specific hacks or hidden reasoning dependencies

Status: `Current decision`

## Main Loop

Per simulated day:

1. simulation resolves overnight outcomes
2. orchestrator generates a morning briefing
3. agent receives the briefing plus available tools
4. agent takes up to `N` turns
5. each turn allows at most one tool call
6. runtime settles the day automatically
7. logs, workspace state, workspace-history entries, and reminders persist into the next day

Status: `Current decision`

Boundary note:

- System 3 consumes seller-facing state plus `current_day`, `market_snapshot`, and `trend_state` from the control API.
- System 3 does not own simulation settlement rules.
- day advancement remains a runtime/control concern, not a seller-facing tool.

## Turn-Slot Model

The loop should feel like a believable owner workday:

- the day starts with a finite number of work slots
- each turn allows exactly one tool call
- all normal tool calls cost one slot
- `end_day` simply stops the day early

Recommended default for the current runtime:

- turns per day: `5`
- one tool call per turn
- workspace and reminders stay available but do not get special cost shaping

Status: `Recommended default`

Current implementation in `src/agent_runtime/loop.py` and `src/agent_runtime/tools/` now uses:

- `DailyLoopConfig(turns_per_day=5)`
- a compact `WorkSessionState` with turn index plus turns total/used/remaining
- one available tool call per turn, without differentiated per-tool slot costs

## Morning Brief

The model should receive a natural seller brief, not runtime JSON to parse.

Recommended sections:

- day and shop header
- primary objective and current business status
- available and pending cash
- yesterday order and revenue summary
- listing movement worth noticing
- new reviews or customer messages
- current workspace text when non-empty, bounded to a reasonable size
- a small recent workspace-history slice
- reminders due today
- market watch items
- short instruction to choose the highest-leverage work

Status: `Current decision`

Current implementation in `src/agent_runtime/briefing.py` now provides both:

- structured payloads for logging and testability
- `MorningBriefing.render_for_agent()` for the provider-facing morning brief text

Memory rule:

- reminders due today should be surfaced automatically
- current workspace text should be injected as-is when non-empty, bounded to a reasonable size
- only a small recent workspace-history slice should be injected, not the full history
- injected workspace content remains seller-visible and inspectable in artifacts

The live briefing path still pulls seller-facing shop, listing, order, review, and payment data through `seller_core`, and world/day state through the separate control API.

## Work Session State

The model should see only the session information needed to operate the current workday:

- current turn number
- work slots left, total, and already used
- tools available right now
- short summaries of work already completed today

Keep this compact. The goal is to support business decisions, not force the model to reconstruct runtime internals.

Status: `Current decision`

Current implementation in `src/agent_runtime/providers/policy.py` uses a plain-language user message with:

- the rendered morning brief
- a short work-session summary
- explicit visibility of workspace/reminder tools
- exact same-day action arguments and tool results carried forward within the workday context
- workspace tools available as ordinary support actions, without forcing a particular planning template

## Turn Rules

- one tool call per turn
- bounded number of turns per day
- stable tool descriptions
- runtime-owned day ending
- no hidden control-plane powers

Status: `Current decision`

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
- `botique-agent-runtime run-day --shop-id <shop_id> --turns-per-day <n>`
- `botique-agent-runtime run-days --shop-id <shop_id> --days <n>`
- `botique-agent-runtime run-tournament --entrants-file <path> --shop-ids <comma-list> --days <n> [--rounds <n>]`
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

The CLI still accepts older `--work-budget` and `--max-turns` flags as compatibility aliases, but the contract is now turn-slot based.

## Prompt Framing

The system prompt should frame the model as operating a business:

## Agent Loop V1 Patch Plan

This section is the concrete near-term runtime plan for getting from a technically working loop to a believable shop-operator loop.

Status: `Current decision` for implementation direction

### Why change the loop

The first live smoke run showed a predictable failure mode:

- repeated low-risk `search_marketplace` calls
- no listing or shop changes
- no workspace/reminder writes
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
5. optional workspace/reminder write if useful
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

- `read_workspace`
- `update_workspace`
- `add_workspace_entry`
- `read_workspace_entries`
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
- workspace/reminders support decisions but do not replace them

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
- inspectable reasoning through action summaries and workspace entries
- automatic day settlement without loop confusion
- artifact bundles that remain easy to compare across runs

### Guardrails

Status: `Current decision`

Avoid:

- exposing provider-specific instructions
- asking for hidden chain-of-thought
- overloading the prompt with runtime bookkeeping fields
- treating workspace/reminder tools as secret runtime capabilities

## Workspace And Reminders

Use simple inspectable support tools only:

- `read_workspace`
- `update_workspace`
- `add_workspace_entry`
- `read_workspace_entries`
- `set_reminder`
- `complete_reminder`

These are part of the visible workday tool surface. They are not hidden from the model, and using them should feel like spending one of the day’s ordinary work slots rather than triggering a special memory subsystem.

Operational rule:

- reminders are push-style resurfacing and should appear when due
- the current workspace is mutable carry-forward memory that the agent may rewrite when useful
- workspace-history entries are pull-style memory and the agent should decide when they are worth reading
- `read_workspace_entries` should stay bounded and targeted rather than dumping the full history
- after each day, the runtime also stores one model-written workspace-history entry outside the work-slot budget so later days have inspectable carry-forward memory

Status: `Current decision`

## Logging

Every day and every turn should log:

- briefing content
- model response summary
- tool name and arguments
- tool result
- turn used
- remaining turn slots after tool calls
- workspace and reminder writes
- day end reason and turn totals

Logs remain part of the product because they make seller strategy legible.

Status: `Current decision`

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
    workspace.json
    workspace_entries.json
    workspace_revisions.json
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

## Tournament Mode

Tournament mode is an additive arena-style extension over the same owner-agent workday loop.

Per tournament day:

1. each entrant receives a morning brief for its assigned shop from the same current world state
2. entrants take their bounded workday turns one shop at a time
3. the shared world advances once after every entrant ends the day

Current fairness defaults:

- rotate entrant execution order across days
- rotate entrant-to-shop assignments across rounds
- reset the world state between rounds using the control API

This keeps the default single-shop loop untouched while making direct competitive runs possible through explicit runtime orchestration rather than hidden seller tools.

## Failure Modes To Guard Against

- repetitive low-value inspection loops
- burning the whole day on bookkeeping instead of business leverage
- hiding support tools or making them feel second-class
- leaking runtime-internal JSON into the provider payload
- ambiguous timing around when world outcomes arrive
- accidentally giving the agent control-plane powers
- treating turn exhaustion as simulation settlement instead of a runtime boundary
