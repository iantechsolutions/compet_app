import { z } from "zod";

const stringToValidIntegerZodTransformer = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => v === null ? 0 : Number(v.toString().replace(/\s/g, "")))
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
  "Stock Fisico": allToString.optional(),
  "Stock Tango": allToString.optional(),
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
    "Stock Fisico"?: string | undefined | null;
    "Stock Tango"?: string | undefined | null;
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
      "Stock Fisico"?: string | undefined | null;
      "Stock Tango"?: string | undefined | null;
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
