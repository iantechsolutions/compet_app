import { z } from "zod";

const stringToValidIntegerZodTransformer = z
  .string()
  .or(z.number())
  .transform((v) => Number(v.toString().replace(/\s/g, "")))
  .refine((value) => !isNaN(value));
const allToString = z
  .union([z.number(), z.string()])
  .transform((value) => {
    console.log(value);
    if (typeof value === "number") {
      return value.toString();
    } else if (typeof value === "string") {
      return value;
    }
  })
  .refine((value) => typeof value === "string", {
    message: "Caracteres incorrectos en columna:",
  });

const recDocValidator = z.object({
  "Codigo Tango": allToString,
  Lote: allToString.optional(),
  Caja: allToString.optional(),
  Ubicación: allToString.optional(),
  Cantidad: stringToValidIntegerZodTransformer,
  Medida: z.number(),
  Unidad: z.enum(["PZA", "KITS", "MT", "UNI"]),
  "Cant de mt/pzas": stringToValidIntegerZodTransformer,
  "Stock Fisico": stringToValidIntegerZodTransformer.optional(),
  "Stock Tango": stringToValidIntegerZodTransformer.optional(),
});

export const recRowsFormat = (rows: Record<string, unknown>[]) => {
  return z.array(recDocValidator).parse(rows);
};

export const recRowsTransformer = (rows: Record<string, unknown>[]) => {
  const finishedArray: {
    "Codigo Tango": string;
    Lote?: string | undefined | null;
    Caja?: string | undefined | null;
    Ubicación?: string | undefined | null;
    Cantidad: number;
    Medida: number;
    Unidad: "PZA" | "KITS" | "MT" | "UNI";
    "Cant de mt/pzas": number;
    "Stock Fisico"?: number | undefined | null;
    "Stock Tango"?: number | undefined | null;
  }[] = [];
  const errors: z.ZodError<
    {
      "Codigo Tango": string;
      Lote?: string | undefined | null;
      Caja?: string | undefined | null;
      Ubicación?: string | undefined | null;
      Cantidad: number;
      Medida: number;
      Unidad: "PZA" | "KITS" | "MT" | "UNI";
      "Cant de mt/pzas": number;
      "Stock Fisico"?: number | undefined | null;
      "Stock Tango"?: number | undefined | null;
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
