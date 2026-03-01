import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeAny } from "zod";

import {
  advanceDayRequestSchema,
  advanceDayResultSchema,
  dayBriefingSchema,
  daySnapshotListSchema,
  marketSnapshotSchema,
  memoryNoteListSchema,
  memoryReminderListSchema,
  resetWorldRequestSchema,
  runLaunchRequestSchema,
  runLaunchResponseSchema,
  runListEntrySchema,
  runListSchema,
  runManifestSchema,
  runSummarySchema,
  simulationDaySchema,
  simulationScenarioSchema,
  turnRecordListSchema,
  tournamentLaunchRequestSchema,
  tournamentLaunchResponseSchema,
  tournamentListSchema,
  tournamentResultSchema,
  trendStateSchema,
  worldStateInputSchema,
  worldStateSchema
} from "../schemas/control";
import type { StoredWorldState } from "../simulation/state-types";
import type { RuntimeControlService } from "../services/runtime-control-service";
import type { RunControlService } from "../services/run-control-service";
import type { TournamentControlService } from "../services/tournament-control-service";
import { registerRouteErrorHandler } from "./error-handler";
function sendValidated<TSchema extends ZodTypeAny>(
  reply: FastifyReply,
  schema: TSchema,
  payload: unknown,
  statusCode = 200
) {
  const validated = schema.parse(payload);
  reply.code(statusCode);
  return validated;
}

export async function registerControlRoutes(
  app: FastifyInstance,
  service: RuntimeControlService,
  runService: RunControlService,
  tournamentService: TournamentControlService,
) {
  app.get("/simulation/day", async (_request, reply) =>
    sendValidated(reply, simulationDaySchema, await service.getCurrentDay())
  );

  app.get("/simulation/scenario", async (_request, reply) =>
    sendValidated(reply, simulationScenarioSchema, await service.getScenario())
  );

  app.get("/simulation/market-snapshot", async (_request, reply) =>
    sendValidated(reply, marketSnapshotSchema, await service.getMarketSnapshot())
  );

  app.get("/simulation/trend-state", async (_request, reply) =>
    sendValidated(reply, trendStateSchema, await service.getTrendState())
  );

  app.post("/simulation/advance-day", async (request, reply) =>
    sendValidated(
      reply,
      advanceDayResultSchema,
      await service.advanceDay(advanceDayRequestSchema.parse(request.body ?? {}))
    )
  );

  app.post("/world/reset", async (request, reply) =>
    sendValidated(
      reply,
      worldStateSchema,
      await service.resetWorld(resetWorldRequestSchema.parse(request.body ?? {}))
    )
  );

  app.get("/world-state", async (_request, reply) =>
    sendValidated(reply, worldStateSchema, await service.getWorldState())
  );

  app.post("/world-state", async (request, reply) =>
    sendValidated(
      reply,
      worldStateSchema,
      await service.replaceWorldState(worldStateInputSchema.parse(request.body) as StoredWorldState)
    )
  );

  app.get("/tournaments", async (_request, reply) =>
    sendValidated(reply, tournamentListSchema, await tournamentService.listTournaments())
  );

  app.get("/runs", async (_request, reply) =>
    sendValidated(reply, runListSchema, await runService.listRuns())
  );

  app.get("/runs/:runId/summary", async (request, reply) =>
    sendValidated(
      reply,
      runSummarySchema,
      await runService.getRunSummary((request.params as { runId: string }).runId)
    )
  );

  app.get("/runs/:runId/manifest", async (request, reply) =>
    sendValidated(
      reply,
      runManifestSchema,
      await runService.getRunManifest((request.params as { runId: string }).runId)
    )
  );

  app.get("/runs/:runId/days", async (request, reply) =>
    sendValidated(
      reply,
      daySnapshotListSchema,
      await runService.getRunDaySnapshots((request.params as { runId: string }).runId)
    )
  );

  app.get("/runs/:runId/days/:day/briefing", async (request, reply) =>
    sendValidated(
      reply,
      dayBriefingSchema,
      await runService.getRunDayBriefing(
        (request.params as { runId: string; day: string }).runId,
        Number((request.params as { runId: string; day: string }).day),
      )
    )
  );

  app.get("/runs/:runId/days/:day/turns", async (request, reply) =>
    sendValidated(
      reply,
      turnRecordListSchema,
      await runService.getRunDayTurns(
        (request.params as { runId: string; day: string }).runId,
        Number((request.params as { runId: string; day: string }).day),
      )
    )
  );

  app.get("/runs/:runId/memory/notes", async (request, reply) =>
    sendValidated(
      reply,
      memoryNoteListSchema,
      await runService.getRunMemoryNotes((request.params as { runId: string }).runId)
    )
  );

  app.get("/runs/:runId/memory/reminders", async (request, reply) =>
    sendValidated(
      reply,
      memoryReminderListSchema,
      await runService.getRunMemoryReminders((request.params as { runId: string }).runId)
    )
  );

  app.post("/runs/launch", async (request, reply) =>
    sendValidated(
      reply,
      runLaunchResponseSchema,
      await runService.launchRun(runLaunchRequestSchema.parse(request.body ?? {})),
      201
    )
  );

  app.get("/tournaments/:tournamentId", async (request, reply) =>
    sendValidated(
      reply,
      tournamentResultSchema,
      await tournamentService.getTournamentResult(
        (request.params as { tournamentId: string }).tournamentId
      )
    )
  );

  app.post("/tournaments/launch", async (request, reply) =>
    sendValidated(
      reply,
      tournamentLaunchResponseSchema,
      await tournamentService.launchTournament(
        tournamentLaunchRequestSchema.parse(request.body ?? {})
      ),
      201
    )
  );

  registerRouteErrorHandler(app);
}
