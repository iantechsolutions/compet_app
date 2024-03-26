import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { settings, userSettings } from "~/server/db/schema";

export async function getSetting<T>(key: string): Promise<T | null> {
    const setting = await db.query.settings.findFirst({
        where: eq(settings.key, key)
    })

    return (setting?.value as T) ?? null
}

export async function setSetting<T>(key: string, value: T) {
    await db.insert(settings)
        .values({
            key,
            value,
        }).onDuplicateKeyUpdate({
            set: {
                value: value,
            }
        })
}

export async function deleteSetting(key: string) {
    const r = await db.delete(settings)
        .where(eq(settings.key, key))
    return r.rowsAffected == 1
}

export async function getUserSetting<T>(key: string, userId: string): Promise<T | null>{
    const setting = await db.query.userSettings.findFirst({
        where: and(eq(userSettings.key, key), eq(userSettings.userId, userId))
    })

    return (setting?.value as T) ?? null
}

export async function setUserSetting<T>(key: string, userId: string, value: T) {
    await db.insert(userSettings)
        .values({
            key,
            userId,
            value,
        }).onDuplicateKeyUpdate({
            set: {
                value: value,
            }
        })
}

export async function deleteUserSetting(key: string, userId: string) {
    const r = await db.delete(userSettings)
        .where(and(eq(userSettings.key, key), eq(userSettings.userId, userId)))
    return r.rowsAffected == 1
}