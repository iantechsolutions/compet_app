import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { CutUnitsZEnum } from "~/lib/types";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const cutsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        prodId: z.string().min(1).max(255),
        lote: z.string().min(1).max(255),
        caja: z.string().min(1).max(255),
        location: z.string().min(1).max(255),
        amount: z.number().nonnegative(),
        measure: z.number().nonnegative(),
        units: z.enum(CutUnitsZEnum),
        stockPhys: z.string(),
        stockTango: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return await db
        .insert(schema.cuts)
        .values({
          amount: input.amount,
          caja: input.caja,
          location: input.location,
          lote: input.lote,
          measure: input.measure,
          prodId: input.prodId,
          stockPhys: input.stockPhys,
          stockTango: input.stockTango,
          units: input.units,
        })
        .returning();
    }),
  list: protectedProcedure.query(async () => {
    return await db.query.cuts.findMany();
  }),
  get: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .query(async ({ input }) => {
      return await db.query.cuts.findFirst({
        where: eq(schema.cuts.id, input.id),
      });
    }),
  getByProdId: protectedProcedure.input(z.object({ prodId: z.string() })).mutation(async ({ input }) => {
    return await db.query.cuts.findMany({
      where: eq(schema.cuts.prodId, input.prodId),
    });
  }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      await db.delete(schema.cuts).where(eq(schema.cuts.id, input.id));
      return "ok";
    }),
  cut: protectedProcedure
    .input(z.object({
      id: z.number(),
      amount: z.number().int().positive(),
      measure: z.number().nonnegative()
    }))
    .mutation(async ({ input }) => {
      const cut = await db.query.cuts.findFirst({
        where: eq(schema.cuts.id, input.id),
      });

      if (!cut) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (cut.measure < input.measure) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      const consumidosMeasure = new Map<number, number>();
      let amountRestante = input.amount;
      for (let i = 0; i < cut.amount && amountRestante > 0; i++) {
        let measure = cut.measure;
        while (measure >= input.measure && amountRestante > 0) {
          measure -= input.measure;
          amountRestante -= 1;
          consumidosMeasure.set(i, (consumidosMeasure.get(i) ?? 0) + input.measure);
        }
      }

      if (amountRestante > 0) {
        return "No alcanzan los recortes";
      }

      const newRecortes = new Map<number, number>();
      let consumidosAmount = 0;

      for (const consumido of consumidosMeasure) {
        const consumidoMeasure = consumido[1];
        const newMeasure = cut.measure - consumidoMeasure;
        console.log(`cons ${input.measure} ${input.measure} ${consumidoMeasure / input.measure}`);
        console.log(`new ${newMeasure} ${cut.measure} 1`);
        newRecortes.set(input.measure, (newRecortes.get(input.measure) ?? 0) + (consumidoMeasure / input.measure));
        newRecortes.set(newMeasure, (newRecortes.get(newMeasure) ?? 0) + 1);
        consumidosAmount += 1;
      }

      if (consumidosAmount < cut.amount) {
        newRecortes.set(cut.measure, cut.amount - consumidosAmount);
      }

      const createdIds: number[] = [];
      for (const newRecorte of newRecortes) {
        if (newRecorte[0] < 0) {
          console.error(`cut newRecorte[0] invalid measure`, newRecorte);
        } else if (newRecorte[0] === 0) {
          continue;
        }

        (await db.insert(schema.cuts)
          .values({
            amount: newRecorte[1],
            measure: newRecorte[0],
            prodId: cut.prodId,
            stockPhys: cut.stockPhys,
            stockTango: cut.stockTango,
            units: cut.units,
            caja: cut.caja,
            location: cut.location,
            lote: cut.lote,
          })
          .returning())
          .forEach(v => createdIds.push(v.id));
      }

      await db.delete(schema.cuts)
        .where(eq(schema.cuts.id, cut.id));

      return createdIds;
    }),
  edit: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        prodId: z.string().min(1).max(255).optional(),
        lote: z.string().min(1).max(255).optional(),
        caja: z.string().min(1).max(255).optional(),
        location: z.string().min(1).max(255).optional(),
        amount: z.number().nonnegative().optional(),
        measure: z.number().nonnegative().optional(),
        units: z.enum(CutUnitsZEnum).optional(),
        stockPhys: z.string().optional(),
        stockTango: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const cut = await db.query.cuts.findFirst({
        where: eq(schema.cuts.id, input.id),
      });

      if (cut === undefined) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const res = await db
        .update(schema.cuts)
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
