// import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/node-postgres";

import { Pool } from "pg";

const pool = new Pool({
  connectionString: env.POSTGRES_URL,
});

export const db = drizzle(pool, { schema });
