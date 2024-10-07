import { z } from "zod";

const stringToValidIntegerZodTransformer = z
  .string()
  .or(z.number())
  .transform((v) => Number(v.toString().replace(/\s/g, "")))
  .refine((value) => !isNaN(value));

const recDocValidator = z.object({
  Material: z.string(),
  Lote: z.string(),
  Caja: z.string(),
  Ubicación: z.string(),
  Cantidad: stringToValidIntegerZodTransformer,
  Medida: z.number(),
  Unidad: z.enum(["mt", "ctd"]),
  "Cant de mt./pz": stringToValidIntegerZodTransformer,
  "Stock Fisico":  stringToValidIntegerZodTransformer,
  "Stock Tango":  stringToValidIntegerZodTransformer,
});

export const recRowsFormat = (rows: Record<string, unknown>[]) => {
  return z.array(recDocValidator).parse(rows);
};

export const recRowsTransformer = (rows: Record<string, unknown>[]) => {
  const finishedArray: {
    Material: string;
    Lote: string;
    Caja: string;
    Ubicación: string;
    Cantidad: number;
    Medida: number;
    Unidad: "mt" | "ctd";
    "Cant de mt./pz": number;
      "Stock Fisico": number;
      "Stock Tango": number;
  }[] = [];
  const errors: z.ZodError<
    {
      Material: string;
      Lote: string;
      Caja: string;
      Ubicación: string;
      Cantidad: number;
      Medida: number;
      Unidad: "mt" | "ctd";
      "Cant de mt./pz": number;
      "Stock Fisico": number;
      "Stock Tango": number;
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
