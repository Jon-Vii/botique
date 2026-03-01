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
- keep notes and reminders available as ordinary support tools
- prefer compact inspectable session state over orchestration-heavy payloads
- avoid provider-specific hacks or hidden reasoning dependencies

Status: `Current decision`

## Main Loop

Per simulated day:

1. simulation resolves overnight outcomes
2. orchestrator builds a morning brief from current seller and world state
3. runtime opens a seller work session with a bounded number of work slots for the day
4. the agent takes turns, with at most one tool call per turn
5. each tool call uses one work slot
6. the agent may end the day early with `end_day`
7. the runtime ends the workday automatically when no work slots remain
8. the runtime persists logs, notes, and reminders, then the control/runtime layer advances the simulation between days

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
- notes and reminders stay available but do not get special cost shaping

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
- reminders due today
- market watch items
- short instruction to choose the highest-leverage work

Status: `Current decision`

Current implementation in `src/agent_runtime/briefing.py` now provides both:

- structured payloads for logging and testability
- `MorningBriefing.render_for_agent()` for the provider-facing morning brief text

Memory rule:

- reminders due today should be surfaced automatically
- notes should remain agent-pulled support context rather than being injected into every briefing

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
- explicit visibility of note/reminder tools
- a concise summary of prior turns rather than a raw prior-turn JSON dump

## Turn Rules

- one tool call per turn
- exactly one next action or `end_day`
- every seller tool call spends one turn slot
- notes and reminders remain available as normal tools, not hidden memory
- the runtime still binds the current `shop_id` into shop-scoped tools
- the runtime still owns day-end accounting and simulation advancement

Status: `Current decision`

Current runtime entrypoints:

- `botique-agent-runtime run-day --briefing-file <path>`
- `botique-agent-runtime run-day --shop-id <shop_id>`
- `botique-agent-runtime run-day --shop-id <shop_id> --turns-per-day <n>`
- `botique-agent-runtime run-days --shop-id <shop_id> --days <n>`

The CLI still accepts older `--work-budget` and `--max-turns` flags as compatibility aliases, but the contract is now turn-slot based.

## Prompt Framing

The system prompt should frame the model as operating a business:

- you are running one shop for one workday
- use the remaining work slots where they matter most
- use visible tools only
- use notes/reminders when they help with follow-through
- rely on marketplace evidence when evaluating the business
- stop when more work is not worth a remaining slot

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

These are part of the visible workday tool surface. They are not hidden from the model, and using them should feel like spending one of the day’s ordinary work slots rather than triggering a special memory subsystem.

Operational rule:

- reminders are push-style resurfacing and should appear when due
- notes are pull-style memory and the agent should decide when they are worth reading
- `read_notes` should stay bounded and targeted rather than dumping the full note history

Status: `Current decision`

## Logging

Every day and every turn should log:

- briefing content
- model response summary
- tool name and arguments
- tool result
- turn used
- remaining turn slots after tool calls
- note and reminder writes
- day end reason and turn totals

Logs remain part of the product because they make seller strategy legible.

Status: `Current decision`

## Failure Modes To Guard Against

- repetitive low-value inspection loops
- burning the whole day on bookkeeping instead of business leverage
- hiding support tools or making them feel second-class
- leaking runtime-internal JSON into the provider payload
- ambiguous timing around when world outcomes arrive
- accidentally giving the agent control-plane powers
- treating turn exhaustion as simulation settlement instead of a runtime boundary
