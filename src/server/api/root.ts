import { createTRPCRouter } from '~/server/api/trpc'
import { forecastRouter } from './routers/forecast'
import { mrpDataRouter } from './routers/mrp-data'

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
    forecast: forecastRouter,
    mrpData: mrpDataRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter
