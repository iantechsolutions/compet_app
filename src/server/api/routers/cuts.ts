import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { CutUnitsZEnum } from "~/lib/types";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const cutsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      prodId: z.string().min(1).max(255),
      lote: z.string().min(1).max(255),
      caja: z.string().min(1).max(255),
      location: z.string().min(1).max(255),
      amount: z.number().int().nonnegative(),
      measure: z.number().nonnegative(),
      units: z.enum(CutUnitsZEnum),
      stockPhys: z.number(),
      stockTango: z.number()
    }))
    .mutation(async ({ input }) => {
      return await db.insert(schema.cuts)
        .values({
          amount: input.amount,
          caja: input.caja,
          location: input.location,
          lote: input.lote,
          measure: input.measure,
          prodId: input.prodId,
          stockPhys: input.stockPhys,
          stockTango: input.stockTango,
          units: input.units
        })
        .returning();
    }),
  list: protectedProcedure
    .query(async () => {
      return await db.query.cuts.findMany();
    }),
  get: protectedProcedure
    .input(z.object({
      id: z.number()
    }))
    .query(async ({ input }) => {
      return await db.query.cuts.findFirst({
        where: eq(schema.cuts.id, input.id)
      });
    }),
  delete: protectedProcedure
    .input(z.object({
      id: z.number()
    }))
    .query(async ({ input }) => {
      await db.delete(schema.cuts)
        .where(eq(schema.cuts.id, input.id));
      return "ok";
    }),
  edit: protectedProcedure
    .input(z.object({
      id: z.number(),
      prodId: z.string().min(1).max(255).optional(),
      lote: z.string().min(1).max(255).optional(),
      caja: z.string().min(1).max(255).optional(),
      location: z.string().min(1).max(255).optional(),
      amount: z.number().int().nonnegative().optional(),
      measure: z.number().nonnegative().optional(),
      units: z.enum(CutUnitsZEnum).optional(),
      stockPhys: z.number().optional(),
      stockTango: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      const cut = await db.query.cuts.findFirst({
        where: eq(schema.cuts.id, input.id)
      });

      if (cut === undefined) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const res = await db.update(schema.cuts)
        .set({
          amount: input.amount ?? cut.amount,
          prodId: input.prodId ?? cut.prodId,
          lote: input.lote ?? cut.lote,
          caja: input.caja ?? cut.caja,
          location: input.location ?? cut.location,
          measure: input.measure ?? cut.measure,
          units: input.units ?? cut.units,
          stockPhys: input.stockPhys ?? cut.stockPhys,
          stockTango: input.stockTango ?? cut.stockTango,
        })
        .where(eq(schema.cuts.id, cut.id))
        .returning();

      return res;
    }),
});
