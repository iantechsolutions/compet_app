import "dotenv/config";

import { db } from "~/server/db";
import { settings } from "~/server/db/schema";

await db.insert(settings).values({
  key: "mrp.export-file",
  value: '"808225cc-dfd3-43eb-b5f4-039fed6532b2-9aas34.flatted.json"',
});

await db.insert(settings).values({
  key: "mrp.export-date",
  value: '"Thu Apr 04 2024 14:42:53 GMT-0300 (hora estándar de Argentina)"',
});
