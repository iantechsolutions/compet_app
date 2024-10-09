// import { neon } from "@neondatabase/serverless";
import postgres from "postgres";

import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "~/env";
import * as schema from "./schema";

const sql = postgres(env.POSTGRES_URL);

export const db = drizzle(sql, { schema });
