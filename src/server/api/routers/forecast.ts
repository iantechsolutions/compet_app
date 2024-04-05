import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import * as schema from '~/server/db/schema'
import { eq } from "drizzle-orm";
import { getUserSetting, setUserSetting } from "~/lib/settings";
import { nullProfile } from "~/lib/nullForecastProfile";
import { db } from "~/server/db";

export const forecastRouter = createTRPCRouter({
    createProfile: protectedProcedure.input(z.object({
        name: z.string().min(1),

        includeSales: z.boolean().default(true),
        salesIncrementFactor: z.number().default(0.01),

        includeBudgets: z.boolean().default(true),
        budgetsInclusionFactor: z.number().default(0.01),

        clientInclusionList: z.array(z.string()).nullable().default(null),
    })).mutation(async ({ ctx, input }) => {
        const r = await ctx.db.insert(schema.forecastProfiles).values({
            // @ts-ignore
            budgetsInclusionFactor: input.budgetsInclusionFactor,
            clientInclusionList: input.clientInclusionList,
            includeBudgets: input.includeBudgets,
            includeSales: input.includeSales,
            salesIncrementFactor: input.salesIncrementFactor,
            name: input.name,
        }).returning({ id: schema.forecastProfiles.id })
        return r[0]?.id
    }),
    listProfiles: protectedProcedure.query(async ({ ctx }) => {
        const profiles = await ctx.db.query.forecastProfiles.findMany()

        const profileInUse = await getUserSetting<number>('mrp.current_forecast_profile', ctx.session.user.id)

        return profiles.map(p => ({
            ...p,
            current: p.id == profileInUse,
        }))
    }),
    deleteProfile: protectedProcedure.input(z.object({
        id: z.number(),
    })).mutation(async ({ ctx, input }) => {
        const profileInUse = await getUserSetting<number>('mrp.current_forecast_profile', ctx.session.user.id)

        if (profileInUse == input.id) {
            throw new Error('No se puede eliminar el perfil actual')
        }

        await ctx.db.delete(schema.forecastProfiles).where(eq(schema.forecastProfiles.id, input.id))
    }),
    applyProfile: protectedProcedure.input(z.object({
        id: z.number(),
    })).mutation(async ({ ctx, input }) => {
        await setUserSetting('mrp.current_forecast_profile', ctx.session.user.id, input.id)
    }),
    applyNullProfile: protectedProcedure.mutation(async ({ ctx }) => {
        await setUserSetting('mrp.current_forecast_profile', ctx.session.user.id, null)
    }),
    currentProfile: protectedProcedure.query(({ ctx }) => {
        return getCurrentProfile(ctx.session.user.id)
    }),
    obtainCurrentProfile: protectedProcedure.mutation(({ ctx }) => {
        return getCurrentProfile(ctx.session.user.id)
    }),
})

async function getCurrentProfile(userId: string) {
    const profileInUse = await getUserSetting<number>('mrp.current_forecast_profile', userId)

    if (!profileInUse) return nullProfile

    const profile = await db.query.forecastProfiles.findFirst({
        where: eq(schema.forecastProfiles.id, profileInUse),
    })

    return profile ?? nullProfile
}