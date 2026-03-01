# Tournament Mode

## Purpose

Tournament mode is an additive runtime mode for arena-style Botique runs.

Use it when the goal is to watch multiple entrant agents or model configurations compete in the same shared market over several days.

## Mode Split

Botique has two runtime modes:

- **Isolated run**: one owner agent runs one shop against the seeded surrounding market
- **Tournament mode**: multiple entrants each control one seeded shop inside the same shared market

The isolated run remains the clean baseline for tuning. Tournament mode exists for richer demo behavior, direct competitive comparison, and observing price pressure, catalog collisions, and trend races.

## Loop Shape

Per tournament round:

1. Capture the starting world state
2. Assign entrants to shop slots
3. For each simulated day, every entrant gets a morning brief and bounded work session
4. The world advances once after all entrants finish that day
5. Standings are computed from ending seller-visible shop state

Fairness defaults:

- Reset the shared world to a named scenario before round 1
- Rotate entrant turn order each simulated day
- Rotate entrant-to-shop assignments across rounds
- Reset world state between rounds

## Scenarios

Tournament mode uses the same scenario system as isolated runs:

- **operate**: every entrant starts from the default seeded existing-business setup
- **bootstrap**: every entrant-controlled shop starts with zero listings while the background market stays active

## Scoring

Default scorecard:

- **Primary score**: available cash
- **Supporting diagnostics**:
  - Pending cash
  - Total sales count
  - Review average and count
  - Active and draft listing counts
  - Notes written and open reminders

Scoring is grounded in seller-visible business outcomes rather than hidden world internals.
