import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as xlsx from "xlsx";
import { recRowsFormat, recRowsTransformer } from "~/server/upload/validator";
export const excelCutsDocRouter = createTRPCRouter({
  get: protectedProcedure.input(z.object({ uploadId: z.string() })).query(async ({ input }) => {
    return await db.query.excelCutsDocs.findFirst({
      where: eq(schema.excelCutsDocs.id, input.uploadId),
    });
  }),
  deserialization: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const recRows = await readExcelFile(input.id);
    return recRows;
  }),
  confirmData: protectedProcedure.input(z.object({ uploadId: z.string() })).mutation(async ({ input }) => {
    console.log("hola");
    const recRows = await readExcelFile(input.uploadId);
    if (!(recRows instanceof TRPCError)) {
      await Promise.all(
        recRows.map(async (row) => {
          await db.insert(schema.cuts).values({
            prodId: row.codigoCompet,
            lote: row.lote,
            caja: row.caja,
            location: row.ubicacion,
            amount: row.cantidad,
            measure: row.medida,
            units: row.unidad,
            stockPhys: row.cantidadTotalMetros,
            stockTango: row.stockTango,
          });
        }),
      );
    }
  }),
});

async function readExcelFile(uploadId: string) {
  const upload = await db.query.excelCutsDocs.findFirst({
    where: eq(schema.excelCutsDocs.id, uploadId),
  });
  if (!upload) {
    return new TRPCError({ code: "NOT_FOUND" });
  }
  const response = await fetch(upload?.url);
  if (!response) {
    return new TRPCError({ code: "NOT_FOUND" });
  }
  const content = await response.arrayBuffer();

  const workbook = xlsx.read(content, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]!]!;
  const rows = xlsx.utils.sheet_to_json(firstSheet) as unknown as Record<string, unknown>[];
  const trimmedRows = rows.map(trimObject);
  if (trimmedRows.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No se encontraron datos en el archivo",
    });
  }
  const { finishedArray: transformedRows, errors: errorsTransform } = recRowsTransformer(trimmedRows);
  const errors: string[] = [];
  errorsTransform.forEach((error) => {
    errors.push(
      (error.errors.at(0)?.message ?? "") +
        " " +
        (error.errors.at(0)?.path.at(1) ?? "ILEGIBLE") +
        " (fila:" +
        (parseInt(error.errors.at(0)?.path.at(0)?.toString() ?? "0") + 1).toString() +
        ")",
    );
  });
  if (errors.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: errors.join("\n") });
  }
  return transformedRows;
}

function trimObject(obj: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (typeof value === "string") {
        const t = value.trim();

        if (t === "") {
          return [key, null];
        }

        return [key, t];
      }

      return [key, value];
    }),
  );
}
