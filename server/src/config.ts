import { z } from "zod";

const configSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.coerce.number().int().positive().default(3000),
  databaseUrl: z.string().min(1).optional()
});

export type BotiqueServerConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotiqueServerConfig {
  return configSchema.parse({
    host: env.BOTIQUE_SERVER_HOST ?? env.HOST,
    port: env.BOTIQUE_SERVER_PORT ?? env.PORT,
    databaseUrl: env.DATABASE_URL
  });
}
