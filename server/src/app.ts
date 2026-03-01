import formbody from "@fastify/formbody";
import Fastify, { type FastifyInstance } from "fastify";

import { loadConfig, type BotiqueServerConfig } from "./config";
import { createInMemoryMarketplaceRepository } from "./repositories/in-memory-marketplace-repository";
import { PostgresMarketplaceRepository } from "./repositories/postgres-marketplace-repository";
import type { MarketplaceRepository } from "./repositories/types";
import { registerCoreRoutes } from "./routes/core-routes";
import { registerControlRoutes } from "./routes/control-routes";
import { MarketplaceService } from "./services/marketplace-service";
import { RuntimeControlService } from "./services/runtime-control-service";
import { TournamentControlService } from "./services/tournament-control-service";
import { createWorldSimulation } from "./simulation/world-simulation";

export type BuildAppOptions = {
  config?: Partial<BotiqueServerConfig>;
  repository?: MarketplaceRepository;
  logger?: boolean;
  tournamentService?: TournamentControlService;
};

async function buildRepository(config: BotiqueServerConfig): Promise<MarketplaceRepository> {
  if (config.databaseUrl) {
    return PostgresMarketplaceRepository.create(config.databaseUrl);
  }

  return createInMemoryMarketplaceRepository();
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const baseConfig = loadConfig();
  const config: BotiqueServerConfig = {
    ...baseConfig,
    ...options.config
  };

  const repository = options.repository ?? (await buildRepository(config));
  const simulation = createWorldSimulation(repository);
  const service = new MarketplaceService(repository, simulation);
  const controlService = new RuntimeControlService(simulation);
  const controlHost = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
  const tournamentService =
    options.tournamentService ??
    new TournamentControlService({
      applicationBaseUrl: `http://${controlHost}:${config.port}/v3/application`,
      controlBaseUrl: `http://${controlHost}:${config.port}/control`,
    });

  const app = Fastify({
    logger: options.logger ?? false
  });

  await app.register(formbody);
  await app.register(async (instance) => {
    await registerCoreRoutes(instance, service);
  }, { prefix: "/v3/application" });
  await app.register(async (instance) => {
    await registerControlRoutes(instance, controlService, tournamentService);
  }, { prefix: "/control" });

  app.get("/health", async () => ({
    ok: true,
    storage: config.databaseUrl ? "postgres" : "memory"
  }));

  return app;
}
