import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import * as schema from '~/server/db/schema'
import { eq } from "drizzle-orm";
import { getSetting, setSetting } from "~/lib/settings";

export const forecastRouter = createTRPCRouter({
    createProfile: protectedProcedure.input(z.object({
        name: z.string().min(1),

        includeSales: z.boolean().default(true),
        salesIncrementFactor: z.number().default(0.01),

        includeBudgets: z.boolean().default(true),
        budgetsInclusionFactor: z.number().default(0.01),

        clientInclusionList: z.array(z.string()).nullable().default(null),
    })).mutation(async ({ ctx, input }) => {
        await ctx.db.insert(schema.forecastProfiles).values(input)
    }),
    listProfiles: protectedProcedure.query(async ({ ctx }) => {
        const profiles = await ctx.db.query.forecastProfiles.findMany()

        const profileInUse = await getSetting<number>('mrp.current_forecast_profile')

        return profiles.map(p => ({
            ...p,
            current: p.id == profileInUse,
        }))
    }),
    deleteProfile: protectedProcedure.input(z.object({
        id: z.number(),
    })).mutation(async ({ ctx, input }) => {
        const profileInUse = await getSetting<number>('mrp.current_forecast_profile')

        if (profileInUse == input.id) {
            throw new Error('No se puede eliminar el perfil actual')
        }

        await ctx.db.delete(schema.forecastProfiles).where(eq(schema.forecastProfiles.id, input.id))
    }),
    applyProfile: protectedProcedure.input(z.object({
        id: z.number(),
    })).mutation(async ({ ctx, input }) => {
        await setSetting('mrp.current_forecast_profile', input.id)
    }),
})
