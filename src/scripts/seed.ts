import 'dotenv/config'

import { db } from "~/server/db";
import { settings } from '~/server/db/schema';

await db.insert(settings).values({
    key: 'mrp.export-file',
    value: '"ea43f9b3-5ae8-4e21-831c-4f6ef7324b4a-9aas34.flatted.json"'
})

await db.insert(settings).values({
    key: 'mrp.export-date',
    value: '"Thu Apr 04 2024 14:42:53 GMT-0300 (hora estándar de Argentina)"'
})