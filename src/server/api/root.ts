import { createTRPCRouter } from "~/server/api/trpc";
import { forecastRouter } from "./routers/forecast";
import { mrpDataRouter } from "./routers/mrp-data";
import { statisticsRouter } from "./routers/statistics";
import { mailRouter } from "./routers/mail";
import { consultRouter } from "./routers/consult";
import { dbRouter } from "./routers/db";
import { cutsRouter } from "./routers/cuts";
import {excelCutsDocRouter} from "./routers/exceldocs-router";
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
  db: dbRouter,
  cuts: cutsRouter,
  excelCutsDoc: excelCutsDocRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
