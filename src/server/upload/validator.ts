import { z } from "zod";

const stringToValidIntegerZodTransformer = z
  .string()
  .or(z.number())
  .transform((v) => Number(v.toString().replace(/\s/g, "")))
  .refine((value) => !isNaN(value));


export const recDocValidator = z.object({
    codigoCompet: stringToValidIntegerZodTransformer,
    lote: z.string(),
    caja: z.string(),
    ubicacion: z.string(),
    cantidad: stringToValidIntegerZodTransformer,
    medida: z.string(),
    unidad: z.enum(["mt", "ctd"]),
    cantidadTotalMetros: stringToValidIntegerZodTransformer,
    stockFisico: stringToValidIntegerZodTransformer,
    stockTango: stringToValidIntegerZodTransformer
})

export const recRowsFormat = (rows: Record<string, unknown>[]) => {
  return z.array(recDocValidator).parse(rows);
};