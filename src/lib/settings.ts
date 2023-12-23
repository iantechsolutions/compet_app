import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { settings } from "~/server/db/schema";

export async function getSetting<T>(key: string): Promise<T | null> {
    const setting = await db.query.settings.findFirst({
        where: eq(settings.key, key)
    })

    return setting?.value ?? null
}

export async function setSetting<T>(key: string, value: T) {
    await db.insert(settings)
        .values({
            key,
            value,
        }).onDuplicateKeyUpdate({
            set: {
                value: value as any,
            }
        })
}

export async function deleteSetting(key: string) {
    const r = await db.delete(settings)
        .where(eq(settings.key, key))
    return r.rowsAffected == 1
}