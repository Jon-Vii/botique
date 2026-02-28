import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { AppError } from "../errors";

export function registerRouteErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        ok: false,
        error: {
          type: error.name,
          message: error.message,
          details: error.details ?? null
        }
      });
    }

    if (error instanceof ZodError) {
      return reply.code(500).send({
        ok: false,
        error: {
          type: "ResponseValidationError",
          message: "Server produced an invalid response.",
          details: error.flatten()
        }
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      ok: false,
      error: {
        type: "InternalServerError",
        message: "Unexpected server error."
      }
    });
  });
}
