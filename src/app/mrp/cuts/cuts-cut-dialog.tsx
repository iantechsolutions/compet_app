"use client";
import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import type { RouterOutputs } from "~/trpc/shared";
import { useRouter } from "next/navigation";
import { fromCutVisualMeasure, getCutVisualMeasure } from "~/lib/utils";

export function CutDialog({ children, cut }: { children: ReactNode, cut: RouterOutputs['cuts']['list'][number] }) {
  const cutMut = api.cuts.cut.useMutation();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const formSchema = z.object({
    amount: z.coerce.number().positive('El número debe ser positivo')
      .int('El número debe ser un entero'),
    measure: z.coerce.number().positive('El número debe ser positivo')
      .max(cut.measure, 'El número no puede ser más grande que la medida del recorte'),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    cutMut.mutateAsync({
      id: cut.id,
      amount: values.amount,
      measure: fromCutVisualMeasure(values.measure, cut.units),
    }).then(v => {
      if (v.length > 0) {
        console.log('Ok');
        setOpen(false);
        router.refresh();
      }
    }).catch(e => {
      console.error('onSubmit', e);
      router.refresh();
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Realizar Recorte</DialogTitle>
          <DialogDescription>
            Seleccione la cantidad y medida de recortes
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cantidad</FormLabel>
                    <FormControl>
                      <Input placeholder={cut.amount.toFixed(0)} {...field} />
                    </FormControl>
                    <FormDescription>
                      Esta es la cantidad de recortes a hacer con la medida especificada
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="measure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medida</FormLabel>
                    <FormControl>
                      <Input placeholder={getCutVisualMeasure(cut.measure, cut.units).toFixed(2)} {...field} />
                    </FormControl>
                    <FormDescription>
                      Esta es la medida de los recortes a hacer ({cut.units})
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Realizar</Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
