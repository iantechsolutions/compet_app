import { z } from "zod";

const stringToValidIntegerZodTransformer = z
  .string()
  .or(z.number())
  .transform((v) => Number(v.toString().replace(/\s/g, "")))
  .refine((value) => !isNaN(value));

const recDocValidator = z.object({
  codigoCompet: z.string(),
  lote: z.string(),
  caja: z.string(),
  ubicacion: z.string(),
  cantidad: stringToValidIntegerZodTransformer,
  medida: z.number(),
  unidad: z.enum(["mt", "ctd"]),
  cantidadTotalMetros: stringToValidIntegerZodTransformer,
  stockFisico: stringToValidIntegerZodTransformer,
  stockTango: stringToValidIntegerZodTransformer,
});

export const recRowsFormat = (rows: Record<string, unknown>[]) => {
  return z.array(recDocValidator).parse(rows);
};

export const recRowsTransformer = (rows: Record<string, unknown>[]) => {
  const finishedArray: {
    codigoCompet: string;
    lote: string;
    caja: string;
    ubicacion: string;
    cantidad: number;
    medida: number;
    unidad: "mt" | "ctd";
    cantidadTotalMetros: number;
    stockFisico: number;
    stockTango: number;
  }[] = [];
  const errors: z.ZodError<
    {
      codigoCompet: string;
      lote: string;
      caja: string;
      ubicacion: string;
      cantidad: number;
      medida: number;
      unidad: "mt" | "ctd";
      cantidadTotalMetros: number;
      stockFisico: number;
      stockTango: number;
    }[]
  >[] = [];
  rows.map((row) => {
    const result = z.array(recDocValidator).safeParse([row]);
    if (result.success) {
      const item = result.data[0];
      if (item) {
        finishedArray.push(item);
      }
    } else {
      errors.push(result.error);
    }
  });
  return { finishedArray, errors };
};
