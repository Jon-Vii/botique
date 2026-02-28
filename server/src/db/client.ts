import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export type BotiqueDatabase = PostgresJsDatabase<typeof schema>;

export type DatabaseClient = {
  client: Sql;
  db: BotiqueDatabase;
};

export function createDatabaseClient(connectionString: string): DatabaseClient {
  const client = postgres(connectionString, {
    max: 1,
    prepare: false
  });

  return {
    client,
    db: drizzle(client, { schema })
  };
}
