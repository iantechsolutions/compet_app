"use client";
import { useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import { Loader2Icon } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";
import type { Monolito } from "~/server/api/routers/db";
import { getCutVisualMeasure, onlyUnique } from "~/lib/utils";
import { MultiSelect } from "~/components/multi-select";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export function CutExportDialog({
  children,
  cuts,
  products,
}: {
  children: ReactNode,
  cuts: RouterOutputs['cuts']['list'],
  products: Monolito['products']
}) {
  const cutMut = api.cuts.cut.useMutation();
  const [open, setOpen] = useState(false);
  const [disableProducts, setDisableProducts] = useState(false);

  const [allSelectorEntries, stockFisMap] = useMemo(() => {
    const allProducts = cuts.map(v => v.prodId).filter(onlyUnique).map(v => products.find(k => k.code === v)).filter(v => typeof v === 'object');
    const allSelectorEntries = allProducts.map(p => ({
      value: p.code,
      label: p.code
    }));

    const stockFisMap = new Map<string, number>();
    for (const prod of products) {
      const cutsProd = cuts.filter(v => v.prodId === prod.code);
      stockFisMap.set(prod.code, cutsProd.reduce((acc, v) => acc + (getCutVisualMeasure(v.measure, v.units) * v.amount), 0));
    }

    return [allSelectorEntries, stockFisMap];
  }, [cuts, products]);

  const formSchema = z.object({
    hasEverything: z.boolean().default(false),
    products: z.array(z.string()).default([]),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const excelRows: (string | number)[][] = [[
      "Codigo Tango",
      "Material",
      "Descripción",
      "Código Compet",
      "Lote",
      "Caja",
      "Ubicación",
      "Cantidad",
      "Medida",
      "Unidad",
      "Cant de mt/pzas",
      "Stock Físico",
      "Stock Tango",
      "Diferencia",
      "Ult fecha"
    ]];

    const cutsFiltered = (values.hasEverything ? cuts : cuts.filter(v => values.products.includes(v.prodId))).map(cut => ({
      ...cut,
      product: products.find(k => k.code === cut.prodId)
    }));

    console.log('cutsFiltered', cutsFiltered);

    for (const cut of cutsFiltered) {
      if (!cut.product) {
        console.error('no cut.product for prodId', cut.prodId);
      }

      let stockFis = stockFisMap.get(cut.prodId);
      if (typeof stockFis !== 'number') {
        stockFis = 0;
      }

      excelRows.push([
        cut.prodId,
        (cut.product?.description ?? "") + (cut.product?.additional_description ?? ""), // material
        "DESCRIPCION", // codigo compet
        "CHOCLO", // codigo compet
        cut.lote ?? "",
        cut.caja ?? "",
        cut.location ?? "",
        cut.amount,
        cut.measure,
        cut.units,
        (cut.amount * cut.measure),
        stockFis,
        typeof cut.product?.stock === 'number' ? cut.product?.stock : 0,
        stockFis - (cut.product?.stock ?? 0),
        dayjs(cut.modAt).format("DD/MM/YYYY"),
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BD");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const excelBuffer = XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    });

    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    saveAs(blob, `Recortes_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Exportar excel</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="hasEverything"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 px-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(k) => {
                          field.onChange(k);
                          setDisableProducts(!field.value);
                        }}
                      />
                    </FormControl>
                    <FormLabel>
                      Exportar todos los recortes
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="products"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Productos</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={allSelectorEntries}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        placeholder="Select options"
                        variant="inverted"
                        animation={2}
                        maxCount={3}
                        disabled={disableProducts}
                      />
                    </FormControl>
                    <FormDescription>
                      Elija los productos a exportar.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Descargar {cutMut.isLoading ? <Loader2Icon className="animate-spin ml-2" /> : <></>}</Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
