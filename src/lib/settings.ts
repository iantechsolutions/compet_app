import { and, eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { settings, userSettings } from '~/server/db/schema'

export async function getSetting<T>(key: string): Promise<T | null> {
    const setting = await db.query.settings.findFirst({
        where: eq(settings.key, key),
    })

    return (setting?.value as T) ?? null
}

export async function setSetting<T>(key: string, value: T) {
    try {
        await db.insert(settings).values({
            key,
            value,
        })
    } catch (error) {
        // update
        await db
            .update(settings)
            .set({
                value: value,
            })
            .where(eq(settings.key, key))
    }
}

export async function deleteSetting(key: string) {
    const r = await db.delete(settings).where(eq(settings.key, key))
    return r.rowCount == 1
}

export async function getUserSetting<T>(key: string, userId: string): Promise<T | null> {
    const setting = await db.query.userSettings.findFirst({
        where: and(eq(userSettings.key, key), eq(userSettings.userId, userId)),
    })

    return (setting?.value as T) ?? null
}

export async function setUserSetting<T>(key: string, userId: string, value: T) {
    try {
        await db.insert(userSettings).values({
            key,
            userId,
            value,
        })
    } catch (error) {
        // update
        await db
            .update(userSettings)
            .set({
                value: value,
            })
            .where(and(eq(userSettings.key, key), eq(userSettings.userId, userId)))
    }
}

export async function deleteUserSetting(key: string, userId: string) {
    const r = await db.delete(userSettings).where(and(eq(userSettings.key, key), eq(userSettings.userId, userId)))
    return r.rowCount == 1
}
