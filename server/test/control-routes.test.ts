import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { buildApp } from "../src/app";
import { createInMemoryMarketplaceRepository } from "../src/repositories/in-memory-marketplace-repository";
import { createSampleState } from "./fixtures/sample-state";

describe("Botique server control endpoints", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const tournamentResult = {
    run_id: "tournament_demo_01",
    scenario: {
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001, 1002]
    },
    days_per_round: 5,
    round_count: 2,
    entrants: [
      {
        entrant_id: "mistral-medium",
        display_name: "Mistral Medium",
        provider: "mistral",
        model: "mistral-medium-latest"
      },
      {
        entrant_id: "mistral-small",
        display_name: "Mistral Small",
        provider: "mistral",
        model: "mistral-small-latest"
      }
    ],
    shop_ids: [1001, 1002],
    rounds: [
      {
        round_index: 1,
        run_id: "tournament_demo_01_round_01",
        shop_assignments: [
          { entrant_id: "mistral-medium", shop_id: 1001 },
          { entrant_id: "mistral-small", shop_id: 1002 }
        ],
        days: [
          {
            day: 3,
            simulation_date: "2026-02-28T00:00:00.000Z",
            turn_order: ["mistral-medium", "mistral-small"],
            entrant_results: [
              { entrant_id: "mistral-medium", live_day: 3 },
              { entrant_id: "mistral-small", live_day: 3 }
            ]
          }
        ],
        standings: [
          {
            rank: 1,
            entrant: {
              entrant_id: "mistral-medium",
              display_name: "Mistral Medium",
              provider: "mistral",
              model: "mistral-medium-latest"
            },
            shop_id: 1001,
            shop_name: "layercake-labs",
            round_index: 1,
            scorecard: {
              primary_score_name: "available_cash",
              primary_score: 56,
              available_cash: 56,
              pending_cash: 0,
              total_sales_count: 2,
              review_average: 5,
              review_count: 1,
              active_listing_count: 2,
              draft_listing_count: 0,
              workspace_entries_written: 3,
              open_reminders: 0,
              final_day: 7,
              final_simulation_date: "2026-03-04T00:00:00.000Z"
            }
          }
        ]
      }
    ],
    standings: [
      {
        rank: 1,
        entrant: {
          entrant_id: "mistral-medium",
          display_name: "Mistral Medium",
          provider: "mistral",
          model: "mistral-medium-latest"
        },
        rounds_played: 2,
        primary_score_name: "available_cash",
        average_primary_score: 56,
        round_scores: [56, 54],
        round_wins: 2,
        average_total_sales_count: 2,
        average_review_average: 5
      }
    ]
  };
  const runList = [
    {
      run_id: "run_demo_01",
      shop_id: 1001,
      mode: "live",
      day_count: 5,
      scenario: {
        scenario_id: "bootstrap",
        controlled_shop_ids: [1001]
      },
      identity: {
        provider: "mistral",
        model: "mistral-medium-latest",
        turns_per_day: 5
      },
      has_summary: true,
      has_manifest: true,
      created_at: "2026-03-01T10:00:00.000Z"
    }
  ];
  const runSummary = {
    run_id: "run_demo_01",
    shop_id: 1001,
    mode: "live",
    day_count: 5,
    scenario: {
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    },
    identity: {
      provider: "mistral",
      model: "mistral-medium-latest",
      turns_per_day: 5
    },
    start_day: 1,
    end_day: 5,
    start_simulation_date: "2026-02-27T00:00:00.000Z",
    end_simulation_date: "2026-03-03T00:00:00.000Z",
    starting_state: {
      available_balance: 28,
      currency_code: "USD",
      active_listing_count: 1,
      draft_listing_count: 1,
      total_sales_count: 1,
      review_average: 5,
      review_count: 1
    },
    ending_state: {
      available_balance: 56,
      currency_code: "USD",
      active_listing_count: 2,
      draft_listing_count: 0,
      total_sales_count: 2,
      review_average: 5,
      review_count: 1
    },
    totals: {
      tool_call_count: 10,
      tool_calls_by_name: { get_shop_dashboard: 5, update_listing: 1 },
      tool_calls_by_surface: { extension: 8, core: 2 },
      turn_count: 10,
      yesterday_revenue: 28,
      notes_written: 3,
      reminders_set: 0,
      reminders_completed: 0,
      simulation_advances: 4
    },
    memory: {
      note_count: 3,
      reminder_count: 0,
      pending_reminder_count: 0
    }
  };
  const runManifest = {
    artifact_version: 1,
    run_id: "run_demo_01",
    shop_id: 1001,
    mode: "live",
    day_count: 5,
    scenario: {
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    },
    identity: {
      provider: "mistral",
      model: "mistral-medium-latest",
      turns_per_day: 5
    },
    invocation: {
      command: "run-days",
      days: 5,
      max_turns: null,
      turns_per_day: 5,
      shop_id: "1001",
      run_id: "run_demo_01",
      provider: "mistral",
      mistral_model: "mistral-medium-latest",
      scenario_id: "bootstrap"
    },
    summary: {
      scenario: {
        scenario_id: "bootstrap",
        controlled_shop_ids: [1001]
      },
      identity: {
        provider: "mistral",
        model: "mistral-medium-latest",
        turns_per_day: 5
      }
    }
  };
  const runDaySnapshots = [
    {
      day: 1,
      simulation_date: "2026-02-27T00:00:00.000Z",
      available_balance: 28,
      currency_code: "USD",
      active_listing_count: 1,
      draft_listing_count: 1,
      total_sales_count: 1,
      review_average: 5,
      review_count: 1,
      turn_count: 2,
      yesterday_revenue: 28
    }
  ];
  const runBriefing = {
    day: 1,
    shop_id: 1001,
    shop_name: "layercake-labs",
    run_id: "run_demo_01",
    generated_at: "2026-03-01T10:00:00.000Z",
    balance_summary: {
      available: 28,
      pending: 0,
      currency_code: "USD"
    },
    objective_progress: {
      primary_objective: "Grow ending balance",
      metric_name: "available_balance",
      current_value: 28,
      target_value: null,
      status_summary: "Available balance is $28.00.",
      supporting_diagnostics: ["active_listings=1"]
    },
    listing_changes: [],
    market_movements: [],
    yesterday_orders: {
      order_count: 1,
      revenue: 28,
      average_order_value: 28,
      refunded_order_count: 0
    },
    new_reviews: [],
    new_customer_messages: [],
    notes: [],
    due_reminders: [],
    priorities_prompt: "Do the highest leverage work."
  };
  const runTurns = [
    {
      turn_index: 1,
      tool_call: {
        name: "get_shop_dashboard",
        arguments: {}
      },
      tool_result: {
        tool_name: "get_shop_dashboard",
        arguments: {},
        output: {
          catalog_summary: {
            active_listings: 1,
            draft_listings: 1,
            total_listings: 2
          }
        },
        surface: "extension"
      },
      decision_summary: "Call get_shop_dashboard.",
      assistant_text: "",
      started_at: "2026-03-01T10:00:00.000Z",
      completed_at: "2026-03-01T10:00:01.000Z",
      state_changes: null,
      provider_tool_calls: []
    }
  ];
  const runNotes = [
    {
      note_id: "ws_entry_123",
      shop_id: 1001,
      title: "Day 1 journal",
      body: "Activated the draft listing.",
      tags: [],
      created_day: 1,
      created_at: "2026-03-01T10:00:00.000Z"
    }
  ];
  const runReminders = [
    {
      reminder_id: "rem_123",
      shop_id: 1001,
      title: "Check backlog",
      body: "Look at backlog tomorrow.",
      due_day: 2,
      completed: false,
      created_at: "2026-03-01T10:00:00.000Z"
    }
  ];

  beforeEach(async () => {
    app = await buildApp({
      repository: createInMemoryMarketplaceRepository(createSampleState()),
      runService: {
        listRuns: async () => runList,
        getRunSummary: async () => runSummary,
        getRunManifest: async () => runManifest,
        getRunDaySnapshots: async () => runDaySnapshots,
        getRunDayBriefing: async () => runBriefing,
        getRunDayTurns: async () => runTurns,
        getRunMemoryNotes: async () => runNotes,
        getRunMemoryReminders: async () => runReminders,
        launchRun: async () => ({ run_id: "run_demo_01" })
      } as any,
      tournamentService: {
        listTournaments: async () => [
          {
            run_id: "tournament_demo_01",
            scenario: tournamentResult.scenario,
            entrant_count: 2,
            round_count: 2,
            days_per_round: 5,
            created_at: "2026-03-01T10:00:00.000Z",
            status: "completed",
            winner: tournamentResult.entrants[0]
          }
        ],
        getTournamentResult: async () => tournamentResult,
        launchTournament: async () => ({ tournament_id: "tournament_demo_01" })
      } as any
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test("reads simulation day, market snapshot, trend state, and debug world state from /control", async () => {
    const [dayResponse, scenarioResponse, snapshotResponse, trendResponse, worldStateResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/simulation/day" }),
      app.inject({ method: "GET", url: "/control/simulation/scenario" }),
      app.inject({ method: "GET", url: "/control/simulation/market-snapshot" }),
      app.inject({ method: "GET", url: "/control/simulation/trend-state" }),
      app.inject({ method: "GET", url: "/control/world-state" })
    ]);

    assert.equal(dayResponse.statusCode, 200);
    assert.deepEqual(dayResponse.json(), {
      day: 3,
      date: "2026-02-28T00:00:00.000Z",
      advanced_at: null
    });

    assert.equal(scenarioResponse.statusCode, 200);
    assert.deepEqual(scenarioResponse.json(), {
      scenario_id: "operate",
      controlled_shop_ids: [1001]
    });

    assert.equal(snapshotResponse.statusCode, 200);
    const snapshot = snapshotResponse.json();
    assert.equal(snapshot.active_listing_count, 4);
    assert.equal(snapshot.active_shop_count, 4);
    assert.ok(snapshot.average_active_price > 0);
    assert.equal(snapshot.total_quantity_on_hand, 8);
    assert.equal(snapshot.total_backlog_units, 2);
    assert.ok(snapshot.taxonomy.length >= 4);

    assert.equal(trendResponse.statusCode, 200);
    const trendState = trendResponse.json();
    assert.equal(trendState.active_trends[0]?.taxonomy_id, 9103);
    assert.equal(trendState.active_trends[1]?.taxonomy_id, 9104);

    assert.equal(worldStateResponse.statusCode, 200);
    const worldState = worldStateResponse.json();
    assert.equal(worldState.marketplace.shops[0].shop_id, 1001);
    assert.equal("listing_active_count" in worldState.marketplace.shops[0], false);
    assert.equal(worldState.simulation.current_day.day, 3);
    assert.equal(worldState.simulation.scenario.scenario_id, "operate");
    assert.deepEqual(worldState.simulation.scenario.controlled_shop_ids, [1001]);
  });

  test("advances the simulation day through /control and persists the updated state", async () => {
    const advanceResponse = await app.inject({
      method: "POST",
      url: "/control/simulation/advance-day"
    });

    assert.equal(advanceResponse.statusCode, 200);
    const advancePayload = advanceResponse.json();
    assert.equal(advancePayload.previous_day.day, 3);
    assert.equal(advancePayload.current_day.day, 4);
    assert.equal(advancePayload.current_day.date, "2026-03-01T00:00:00.000Z");
    assert.deepEqual(
      advancePayload.steps.map((step: { name: string }) => step.name),
      [
        "advance_clock",
        "refresh_trends",
        "release_completed_production",
        "settle_delayed_events",
        "resolve_market_sales",
        "allocate_production",
        "refresh_market_snapshot"
      ]
    );

    const [dayResponse, trendResponse, worldStateResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/simulation/day" }),
      app.inject({ method: "GET", url: "/control/simulation/trend-state" }),
      app.inject({ method: "GET", url: "/control/world-state" })
    ]);

    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.json().day, 4);

    assert.equal(trendResponse.statusCode, 200);
    assert.equal(trendResponse.json().active_trends[0]?.taxonomy_id, 9104);

    assert.equal(worldStateResponse.statusCode, 200);
    assert.equal(worldStateResponse.json().simulation.current_day.day, 4);
    assert.equal(
      worldStateResponse.json().simulation.market_snapshot.generated_at,
      advancePayload.current_day.advanced_at
    );
  });

  test("accepts controlled shop ids when advancing the simulation day", async () => {
    const advanceResponse = await app.inject({
      method: "POST",
      url: "/control/simulation/advance-day",
      payload: {
        controlled_shop_ids: [1001]
      }
    });

    assert.equal(advanceResponse.statusCode, 200);
    const payload = advanceResponse.json();
    assert.equal(payload.previous_day.day, 3);
    assert.equal(payload.current_day.day, 4);
  });

  test("resets the world state through /control back to the initial seeded snapshot", async () => {
    const advanceResponse = await app.inject({
      method: "POST",
      url: "/control/simulation/advance-day"
    });
    assert.equal(advanceResponse.statusCode, 200);

    const resetResponse = await app.inject({
      method: "POST",
      url: "/control/world/reset"
    });
    assert.equal(resetResponse.statusCode, 200);

    const resetPayload = resetResponse.json();
    assert.equal(resetPayload.simulation.current_day.day, 3);
    assert.equal(resetPayload.simulation.current_day.date, "2026-02-28T00:00:00.000Z");
    assert.equal(resetPayload.simulation.scenario.scenario_id, "operate");
    assert.equal(resetPayload.simulation.market_snapshot.active_listing_count, 4);
    assert.equal(resetPayload.marketplace.orders.length, 7);

    const dayResponse = await app.inject({ method: "GET", url: "/control/simulation/day" });
    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.json().day, 3);
  });

  test("supports deterministic bootstrap resets through /control", async () => {
    const resetResponse = await app.inject({
      method: "POST",
      url: "/control/world/reset",
      payload: {
        scenario_id: "bootstrap",
        controlled_shop_ids: [1001]
      }
    });

    assert.equal(resetResponse.statusCode, 200);
    const resetPayload = resetResponse.json();
    assert.deepEqual(resetPayload.simulation.scenario, {
      scenario_id: "bootstrap",
      controlled_shop_ids: [1001]
    });
    assert.equal(
      resetPayload.marketplace.listings.filter((listing: { shop_id: number }) => listing.shop_id === 1001).length,
      0
    );
    assert.equal(resetPayload.marketplace.shops[0].production_queue.length, 0);
    assert.equal(resetPayload.marketplace.orders.filter((order: { shop_id: number }) => order.shop_id === 1001).length, 1);
    assert.equal(resetPayload.marketplace.payments.filter((payment: { shop_id: number }) => payment.shop_id === 1001).length, 1);
    assert.equal(resetPayload.simulation.market_snapshot.active_listing_count, 3);
  });

  test("replaces the world state through /control for repeatable runtime experiments", async () => {
    const originalWorldStateResponse = await app.inject({
      method: "GET",
      url: "/control/world-state"
    });

    assert.equal(originalWorldStateResponse.statusCode, 200);
    const replacementWorldState = originalWorldStateResponse.json();
    replacementWorldState.simulation.current_day = {
      day: 9,
      date: "2026-03-06T00:00:00.000Z",
      advanced_at: "2026-03-05T23:59:59.000Z"
    };
    replacementWorldState.marketplace.shops[0].announcement = "Tournament reset applied.";

    const replaceResponse = await app.inject({
      method: "POST",
      url: "/control/world-state",
      payload: replacementWorldState
    });

    assert.equal(replaceResponse.statusCode, 200);
    assert.equal(replaceResponse.json().simulation.current_day.day, 9);
    assert.equal(
      replaceResponse.json().marketplace.shops[0].announcement,
      "Tournament reset applied."
    );
    assert.equal(replaceResponse.json().simulation.scenario.scenario_id, "operate");

    const [dayResponse, worldStateResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/simulation/day" }),
      app.inject({ method: "GET", url: "/control/world-state" })
    ]);

    assert.equal(dayResponse.statusCode, 200);
    assert.equal(dayResponse.json().day, 9);
    assert.equal(
      worldStateResponse.json().marketplace.shops[0].announcement,
      "Tournament reset applied."
    );
  });

  test("lists, reads, and launches tournaments through /control", async () => {
    const [listResponse, detailResponse, launchResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/control/tournaments" }),
      app.inject({ method: "GET", url: "/control/tournaments/tournament_demo_01" }),
      app.inject({
        method: "POST",
        url: "/control/tournaments/launch",
        payload: {
          entrants: tournamentResult.entrants,
          shop_ids: [1001, 1002],
          days_per_round: 5,
          rounds: 2,
          turns_per_day: 5,
          scenario_id: "bootstrap"
        }
      })
    ]);

    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json()[0].run_id, "tournament_demo_01");
    assert.equal(listResponse.json()[0].scenario.scenario_id, "bootstrap");

    assert.equal(detailResponse.statusCode, 200);
    assert.equal(detailResponse.json().run_id, "tournament_demo_01");
    assert.equal(detailResponse.json().scenario.scenario_id, "bootstrap");
    assert.equal(detailResponse.json().rounds[0].run_id, "tournament_demo_01_round_01");

    assert.equal(launchResponse.statusCode, 201);
    assert.equal(launchResponse.json().tournament_id, "tournament_demo_01");
  });

  test("lists, reads, and launches runs through /control", async () => {
    const [
      listResponse,
      summaryResponse,
      manifestResponse,
      daysResponse,
      briefingResponse,
      turnsResponse,
      notesResponse,
      remindersResponse,
      launchResponse
    ] = await Promise.all([
      app.inject({ method: "GET", url: "/control/runs" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/summary" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/manifest" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/days" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/days/1/briefing" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/days/1/turns" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/memory/notes" }),
      app.inject({ method: "GET", url: "/control/runs/run_demo_01/memory/reminders" }),
      app.inject({
        method: "POST",
        url: "/control/runs/launch",
        payload: {
          shop_id: 1001,
          days: 5,
          turns_per_day: 5,
          run_id: "run_demo_01",
          model: "mistral-medium-latest",
          provider: "mistral",
          scenario_id: "bootstrap"
        }
      })
    ]);

    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.json()[0].run_id, "run_demo_01");
    assert.equal(listResponse.json()[0].scenario.scenario_id, "bootstrap");

    assert.equal(summaryResponse.statusCode, 200);
    assert.equal(summaryResponse.json().totals.notes_written, 3);
    assert.equal(summaryResponse.json().scenario.scenario_id, "bootstrap");

    assert.equal(manifestResponse.statusCode, 200);
    assert.equal(manifestResponse.json().invocation.command, "run-days");
    assert.equal(manifestResponse.json().summary.scenario.scenario_id, "bootstrap");

    assert.equal(daysResponse.statusCode, 200);
    assert.equal(daysResponse.json()[0].turn_count, 2);

    assert.equal(briefingResponse.statusCode, 200);
    assert.equal(briefingResponse.json().shop_name, "layercake-labs");

    assert.equal(turnsResponse.statusCode, 200);
    assert.equal(turnsResponse.json()[0].tool_call.name, "get_shop_dashboard");

    assert.equal(notesResponse.statusCode, 200);
    assert.equal(notesResponse.json()[0].note_id, "ws_entry_123");

    assert.equal(remindersResponse.statusCode, 200);
    assert.equal(remindersResponse.json()[0].reminder_id, "rem_123");

    assert.equal(launchResponse.statusCode, 201);
    assert.equal(launchResponse.json().run_id, "run_demo_01");
  });
});
