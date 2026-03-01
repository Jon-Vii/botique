# Agent Loop

## Purpose

Define the Botique shop-owner loop as a constrained seller workday, not a synthetic action quota.

The AI should feel like a business operator spending a limited day on meaningful shop work inside the environment.

Status: `Current decision` on the workday framing and runtime-owned day settlement. Exact budget sizing remains a `Recommended default`.

## Loop Design Rules

- keep the business objective explicit
- let the environment own outcomes, timing, and day settlement
- keep one tool call per turn
- use a visible daily work budget instead of a hidden action cap
- keep notes and reminders available as ordinary support tools
- prefer compact inspectable session state over orchestration-heavy payloads
- avoid provider-specific hacks or hidden reasoning dependencies

Status: `Current decision`

## Main Loop

Per simulated day:

1. simulation resolves overnight outcomes
2. orchestrator builds a morning brief from current seller and world state
3. runtime opens a seller work session with a bounded daily work budget
4. the agent takes turns, with at most one tool call per turn
5. each tool call spends a small amount of work budget
6. the agent may end the day early with `end_day`
7. the runtime ends the workday automatically when no remaining tool is affordable
8. the runtime persists logs, notes, and reminders, then the control/runtime layer advances the simulation between days

Status: `Current decision`

Boundary note:

- System 3 consumes seller-facing state plus `current_day`, `market_snapshot`, and `trend_state` from the control API.
- System 3 does not own simulation settlement rules.
- day advancement remains a runtime/control concern, not a seller-facing tool.

## Work Budget Model

The loop should feel like a believable owner workday:

- the day starts with a finite work budget
- each tool advertises a small integer work cost
- cheap inspection and support actions usually cost `1`
- heavier shop-changing actions such as listing or shop updates may cost `2`
- `end_day` costs `0`

Recommended default for the current runtime:

- daily work budget: `8`
- core read/search tools: `1`
- note/reminder tools: `1`
- create/update/delete listing and `update_shop`: `2`

Status: `Recommended default`

Current implementation in `src/agent_runtime/loop.py` and `src/agent_runtime/tools/` now uses:

- `DailyLoopConfig(work_budget=8)`
- `ToolManifestEntry.work_cost`
- a compact `WorkSessionState` with turn index plus budget total/spent/remaining
- affordable-tool filtering each turn so the model only sees actions it can still pay for

## Morning Brief

The model should receive a natural seller brief, not runtime JSON to parse.

Recommended sections:

- day and shop header
- primary objective and current business status
- available and pending cash
- yesterday order and revenue summary
- listing movement worth noticing
- new reviews or customer messages
- reminders due today
- market watch items
- recent notes worth carrying into the day
- short instruction to choose the highest-leverage work

Status: `Current decision`

Current implementation in `src/agent_runtime/briefing.py` now provides both:

- structured payloads for logging and testability
- `MorningBriefing.render_for_agent()` for the provider-facing morning brief text

The live briefing path still pulls seller-facing shop, listing, order, review, and payment data through `seller_core`, and world/day state through the separate control API.

## Work Session State

The model should see only the session information needed to operate the current workday:

- current turn number
- work budget left, total, and already spent
- tools still affordable right now, including work cost
- short summaries of work already completed today

Keep this compact. The goal is to support business decisions, not force the model to reconstruct runtime internals.

Status: `Current decision`

Current implementation in `src/agent_runtime/providers/policy.py` uses a plain-language user message with:

- the rendered morning brief
- a short work-session summary
- explicit visibility of note/reminder tools
- a concise summary of prior turns rather than a raw prior-turn JSON dump

## Turn Rules

- one tool call per turn
- exactly one next action or `end_day`
- every seller tool call spends work budget
- only currently affordable tools are exposed for the next turn
- notes and reminders remain available as normal tools, not hidden memory
- the runtime still binds the current `shop_id` into shop-scoped tools
- the runtime still owns day-end accounting and simulation advancement

Status: `Current decision`

Current runtime entrypoints:

- `botique-agent-runtime run-day --briefing-file <path>`
- `botique-agent-runtime run-day --shop-id <shop_id>`
- `botique-agent-runtime run-day --shop-id <shop_id> --work-budget <n>`
- `botique-agent-runtime run-days --shop-id <shop_id> --days <n>`

The CLI still accepts the older `--max-turns` flag as a compatibility alias, but the contract is now work-budget based.

## Prompt Framing

The system prompt should frame the model as operating a business:

- you are running one shop for one workday
- spend the remaining budget where it matters most
- use visible tools only
- use notes/reminders when they help with follow-through
- rely on marketplace evidence when evaluating the business
- stop when more work is not worth the remaining budget

Status: `Current decision`

Avoid:

- exposing provider-specific instructions
- asking for hidden chain-of-thought
- overloading the prompt with runtime bookkeeping fields
- treating note/reminder tools as secret runtime capabilities

## Notes And Reminders

Use simple inspectable support tools only:

- `write_note`
- `read_notes`
- `set_reminder`
- `complete_reminder`

These are part of the visible workday tool surface. They are not hidden from the model and they do consume work budget like other small support tasks.

Status: `Current decision`

## Logging

Every day and every turn should log:

- briefing content
- model response summary
- tool name and arguments
- tool result
- work cost spent
- remaining budget after tool calls
- note and reminder writes
- day end reason and budget totals

Logs remain part of the product because they make seller strategy legible.

Status: `Current decision`

## Failure Modes To Guard Against

- repetitive low-value inspection loops
- burning the whole budget on bookkeeping instead of business leverage
- hiding support tools or making them feel second-class
- leaking runtime-internal JSON into the provider payload
- ambiguous timing around when world outcomes arrive
- accidentally giving the agent control-plane powers
- treating budget exhaustion as simulation settlement instead of a runtime boundary
