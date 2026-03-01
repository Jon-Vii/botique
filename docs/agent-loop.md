# Agent Loop

## Purpose

Define the Botique shop-owner runtime as a constrained seller workday with explicit memory and inspectable artifacts.

The agent should feel like a business operator spending a limited day on meaningful work inside the environment.

Status: `Current decision`

## Loop Design Rules

- keep the business objective explicit
- let the environment own outcomes, timing, and day settlement
- keep one available action per work slot
- use a visible daily work-slot limit instead of hidden action shaping
- keep journal and reminders available as ordinary daytime support tools
- keep same-day context intact inside one workday window
- keep cross-day memory explicit and inspectable through scratchpad text, journal entries, and reminders
- avoid provider-specific hacks or hidden reasoning dependencies

Status: `Current decision`

## Main Loop

Per simulated day:

1. System 2 resolves overnight outcomes
2. System 3 generates a morning briefing from seller-visible state
3. the agent receives the briefing plus the allowed tool surface
4. the agent spends up to `N` work slots
5. each work slot allows exactly one action
6. the agent may end the day early
7. the runtime settles the day
8. the runtime revises the scratchpad at end of day for the next day
9. logs, scratchpad state, journal entries, reminders, and artifacts persist

Status: `Current decision`

Boundary note:

- System 3 consumes seller-facing state plus `current_day`, `market_snapshot`, and `trend_state` from the control API
- System 3 does not own simulation settlement rules
- day advancement remains a runtime/control concern, not a seller-facing tool

## Workday Model

The loop should feel like a believable owner workday:

- the day starts with a finite number of work slots
- each work slot allows exactly one action
- all ordinary actions consume one slot
- `end_day` simply stops the day early

Recommended default for the current runtime:

- turns per day: `5`
- one action per work slot
- journal and reminders stay available during the day without special cost shaping
- scratchpad revision happens in the end-of-day phase rather than spending a daytime work slot

Status: `Recommended default`

Current implementation in `src/agent_runtime/loop.py` uses:

- `DailyLoopConfig(turns_per_day=5)`
- a compact `WorkSessionState` with turn index plus total/used/remaining slots
- one available action per slot, without differentiated per-tool costs

## Morning Brief

The model should receive a natural seller brief, not runtime JSON to parse.

Recommended sections:

- date and shop header
- primary objective and current business status
- available and pending cash
- yesterday order and revenue summary
- listing movement worth noticing
- new reviews or customer messages
- current scratchpad text when non-empty, bounded to a reasonable size
- a small recent journal slice
- reminders due today
- market watch items
- short instruction to choose the highest-leverage work

Status: `Current decision`

Current implementation in `src/agent_runtime/briefing.py` provides both:

- structured payloads for logging and tests
- `MorningBriefing.render_for_agent()` for the provider-facing brief text

Memory rule:

- reminders due today should be surfaced automatically
- current scratchpad text should be injected as-is when non-empty, bounded to a reasonable size, so the agent can revise it for later days without losing the existing text
- only a small recent journal slice should be injected, not the full history
- injected scratchpad content remains seller-visible and inspectable in artifacts

## Same-Day Context

The workday should behave like one continuous operating session.

- exact same-day action arguments and tool results stay in-context across work slots
- the runtime should not compress, summarize away, or rewrite the same-day working set
- cross-day context resets to a fresh morning brief plus explicit memory surfaces

Status: `Current decision`

This is intentional:

- same-day context should feel like a continuous work session
- cross-day context should rely on scratchpad, journal entries, reminders, and seller-visible state rather than on unbounded chat history

## Work Session State

The model should see only the session information needed to operate the current workday:

- current work slot
- work slots left, total, and already used
- available actions right now
- work already completed today

Keep this compact. The goal is to support business decisions, not force the model to reconstruct runtime internals.

Status: `Current decision`

Current implementation in `src/agent_runtime/providers/policy.py` uses a plain-language message with:

- the rendered morning brief
- a short work-session summary
- explicit visibility of scratchpad/journal/reminder tools
- exact same-day arguments and tool results carried forward

## Turn Rules

- one action per work slot
- bounded number of slots per day
- stable tool descriptions
- runtime-owned day ending
- no hidden control-plane powers

Status: `Current decision`

Current implementation in `src/agent_runtime/loop.py` uses a `SingleShopDailyLoop` with:

- one `AgentTurnDecision` per slot
- a bounded `turns_per_day` configuration
- explicit `end_day`
- structured day/turn/tool events for debugging and playback
- no delegation or sub-agent assumptions

Runtime note:

- the owner-agent runtime binds the current `shop_id` from the morning briefing into shop-scoped tool calls so the model cannot switch shops by inventing a different seller id mid-run

## End-Of-Day Memory

At the end of each day, the runtime asks the model to revise the persistent scratchpad for later days.

This entry:

- does not consume a daytime work slot
- is freeform rather than template-driven
- is stored through the same memory system used during the day
- produces an inspectable longitudinal memory trace in artifacts

Status: `Current decision`

## Prompt Framing

The system prompt should frame the model as an autonomous business owner:

- no outside user is steering the shop day to day
- the goal is realized business performance over time
- only seller-visible tools and memory surfaces are available
- capacity, backlog, cash, reviews, and market shifts create delayed consequences
- journal and reminders are daytime tools the agent may use when useful, not rituals
- scratchpad revision is an end-of-day cross-day memory step, not an in-day memo ritual

The prompt should explain the environment clearly enough that:

- the model understands draft vs active listings
- the model understands stocked vs made-to-order listings
- the model understands that same-day work is limited
- the model understands that cross-day memory is explicit

## Runtime Entry Points

Current CLI entry points:

- `botique-agent-runtime run-day --briefing-file <path>`
- `botique-agent-runtime run-day --shop-id <shop_id>`
- `botique-agent-runtime run-day --shop-id <shop_id> --turns-per-day <n>`
- `botique-agent-runtime run-days --shop-id <shop_id> --days <n>`
- `botique-agent-runtime run-tournament --entrants-file <path> --shop-ids <comma-list> --days <n> [--rounds <n>]`

Notes:

- `run-days` is the main reference-run path; it builds each morning briefing from live Botique state, executes the workday, advances the simulation, and persists an artifact bundle
- the default provider wiring is Mistral through `MISTRAL_API_KEY` and optional `BOTIQUE_MISTRAL_*` settings, but the loop itself remains provider-agnostic
- live runs accept `--output-dir`; if omitted, artifacts are written under `artifacts/agent-runtime/<timestamp>__shop-...__<run_id>`
- `BOTIQUE_CONTROL_BASE_URL` is optional if the control surface lives next to the seller API; the runtime derives `/control` from `BOTIQUE_CORE_BASE_URL` when omitted

Documented example command:

```bash
BOTIQUE_CORE_BASE_URL=http://localhost:3000/v3/application \
MISTRAL_API_KEY=your-key \
botique-agent-runtime run-days \
  --shop-id 1001 \
  --days 5 \
  --run-id reference_baseline_01 \
  --turns-per-day 5 \
  --output-dir artifacts/agent-runtime/reference-baseline-01 \
  --pretty
```

## Tournament Mode Note

Tournament mode is an additive runtime mode, not a replacement for the single-shop baseline.

The single-shop isolated run remains the cleanest place to:

- inspect traces
- refine prompt/tool ergonomics
- understand memory behavior
- compare runs against a controlled starting point

Tournament mode exists for:

- richer demo behavior
- multi-entrant comparison
- shared-world competitive dynamics

See `docs/tournament-mode.md` for the tournament-specific contract.
