# Tournament Mode

## Purpose

Tournament mode is an additive System 3 runtime mode for arena-style Botique runs.

It does not replace the default single-shop isolated run.

Use it when the goal is to watch multiple entrant agents or model configurations compete in the same shared Botique market over several days.

Status: `Current decision`

## Mode Split

Botique now has two distinct runtime modes:

- isolated run: one owner agent runs one shop against the seeded surrounding market
- tournament mode: multiple entrants each control one seeded shop inside the same shared market

The isolated run remains the clean baseline for prompt and tool-surface tuning.

Tournament mode exists for:

- richer demo behavior
- more direct competitive comparison
- observing price pressure, catalog collisions, and trend races in one shared world

## Loop Shape

Per tournament round:

1. capture the starting world state
2. assign entrants to the chosen shop ids
3. for each simulated day, every entrant gets a morning brief and bounded work session
4. the world advances once after all entrants finish that day
5. standings are computed from ending seller-visible shop state

Current fairness defaults:

- reset the shared world to a named scenario before round 1
- rotate entrant turn order each simulated day
- rotate entrant-to-shop assignments across rounds
- reset the world state back to the captured round-start snapshot between rounds

This keeps arena runs interesting without permanently biasing one entrant toward the strongest seeded shop or the first move every day.

## Scenario Contract

Tournament mode now accepts the same first-class scenario identifiers as isolated runs.

Current canonical options:

- `operate`: every entrant starts from the default seeded existing-business setup
- `bootstrap`: every entrant-controlled shop starts with zero listings while the remaining background market stays active

Current default:

- tournament CLI runs default to `operate` so the opening shared world is deterministic without requiring a manual reset first

## Scoring

Current default scorecard:

- primary score: `available_cash`
- supporting diagnostics:
  - pending cash
  - total sales count
  - review average and count
  - active and draft listing counts
  - notes written and open reminders

This keeps the score grounded in seller-visible business outcomes rather than hidden world internals.

## CLI Contract

Use:

```bash
botique-agent-runtime run-tournament \
  --entrants-file entrants.json \
  --shop-ids 1001,1002 \
  --days 5 \
  --rounds 2 \
  --scenario operate \
  --turns-per-day 5 \
  --pretty
```

Entrants file shape:

```json
{
  "entrants": [
    {
      "entrant_id": "mistral-medium",
      "display_name": "Mistral Medium",
      "provider": "mistral",
      "model": "mistral-medium-latest"
    },
    {
      "entrant_id": "mistral-small",
      "display_name": "Mistral Small",
      "provider": "mistral",
      "model": "mistral-small-latest",
      "temperature": 0.2
    }
  ]
}
```

Current implementation note:

- provider support is entrant-specific in structure, but only `mistral` is implemented today
- tournament mode requires the control API because it snapshots, restores, and advances the shared world

## Control Surface Additions

Tournament mode now relies on these control-plane capabilities:

- `GET /control/world-state`
- `POST /control/world-state`
- `POST /control/simulation/advance-day`

The seller-facing tool surface remains unchanged. Tournament orchestration stays in System 3 and uses only the separate control surface for world reset and day advancement.
