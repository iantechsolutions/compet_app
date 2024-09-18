import { createTRPCRouter } from '~/server/api/trpc'
import { forecastRouter } from './routers/forecast'
import { mrpDataRouter } from './routers/mrp-data'
import { statisticsRouter } from './routers/statistics'
import { mailRouter } from './routers/mail'
import ConsultsPage from '~/app/mrp/consulta/consultPage'
import { consultRouter } from './routers/consult'
/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
    forecast: forecastRouter,
    mrpData: mrpDataRouter,
    statistics: statisticsRouter,
    mail: mailRouter,
    consults: consultRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter
