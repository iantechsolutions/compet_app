import { getDbInstance } from "~/scripts/lib/instance";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

export const dbRouter = createTRPCRouter({
  getProducts: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProducts();
  }),
  getProductByCode: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(255),
      }),
    )
    .query(async ({ input }) => {
      return await (await getDbInstance()).getProductByCode(input.code);
    }),
  getCommitedStock: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getCommitedStock();
  }),
  getProviders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProviders();
  }),
  getProductProviders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductProviders();
  }),
  getAssemblies: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getAssemblies();
  }),
  getImports: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getImports();
  }),
  getProductImports: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductImports();
  }),
  getOrders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getOrders();
  }),
  getProductsOrders: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductsOrders();
  }),
  getClients: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getClients();
  }),
  getSold: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getSold();
  }),
  getProductsSold: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getProductsSold();
  }),
  getBudgets: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getBudgets();
  }),
  getBudgetProducts: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getBudgetProducts();
  }),
  getCrmClients: protectedProcedure.query(async () => {
    return await (await getDbInstance()).getCrmClients();
  }),
});
