import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeAny } from "zod";

import {
  advanceDayResultSchema,
  marketSnapshotSchema,
  simulationDaySchema,
  trendStateSchema,
  worldStateSchema
} from "../schemas/control";
import type { RuntimeControlService } from "../services/runtime-control-service";
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

export async function registerControlRoutes(app: FastifyInstance, service: RuntimeControlService) {
  app.get("/simulation/day", async (_request, reply) =>
    sendValidated(reply, simulationDaySchema, await service.getCurrentDay())
  );

  app.get("/simulation/market-snapshot", async (_request, reply) =>
    sendValidated(reply, marketSnapshotSchema, await service.getMarketSnapshot())
  );

  app.get("/simulation/trend-state", async (_request, reply) =>
    sendValidated(reply, trendStateSchema, await service.getTrendState())
  );

  app.post("/simulation/advance-day", async (_request, reply) =>
    sendValidated(reply, advanceDayResultSchema, await service.advanceDay())
  );

  app.get("/world-state", async (_request, reply) =>
    sendValidated(reply, worldStateSchema, await service.getWorldState())
  );

  app.post("/world-state", async (request, reply) =>
    sendValidated(
      reply,
      worldStateSchema,
      await service.replaceWorldState(worldStateSchema.parse(request.body))
    )
  );

  registerRouteErrorHandler(app);
}
