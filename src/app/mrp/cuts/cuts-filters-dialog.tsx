"use client";
import { useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { CutsFilterDispatch, CutsFilters } from "./cuts-table";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { Loader2Icon, X } from "lucide-react";
import { ComboboxDemo } from "~/components/combobox";
import type { Monolito } from "~/server/api/routers/db";

export function CutFiltersDialog({
  children,
  setFilters,
  filters,
  products,
}: {
  children: ReactNode,
  setFilters: CutsFilterDispatch,
  filters: CutsFilters,
  products: Monolito['products']
}) {
  const { mutateAsync: consultDeps, isLoading } = api.consults.productDependencies.useMutation();
  const codeFilterRef = useRef<HTMLInputElement>(null);
  const descFilterRef = useRef<HTMLInputElement>(null);
  const [artFilter, setArtFilter] = useState<string>('');
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[475px]">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>
            Seleccione filtros a utilizar para la visualización de los recortes
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">
              Código de producto
            </Label>
            <Input ref={codeFilterRef} id="code" placeholder="01014040" defaultValue={filters.prodCode} className="col-span-3" />
          </div>
        </div>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">
              Descripción
            </Label>
            <Input ref={descFilterRef} id="code" placeholder="AZUL" defaultValue={filters.desc} className="col-span-3" />
          </div>
        </div>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4 w-full">
            <Label htmlFor="code" className="text-right">
              Filtrar por artículo
            </Label>
            <div className="flex flex-row w-full">
              <ComboboxDemo
                title="Código de artículo"
                placeholder="Código de artículo"
                value={artFilter}
                onSelectionChange={(value) => {
                  setArtFilter(value);
                }}
                options={products.map((product) => ({
                  value: product.code,
                  label: product.code,
                }))}
              />
              <Button variant="outline" onClick={() => {
                setArtFilter('');
              }}><X /></Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={() => {
            const artCode = artFilter ?? '';
            if (artCode !== '') {
              consultDeps({ productCode: artCode }).then((res) => {
                console.log('res codes', res);
                setFilters({
                  prodCode: codeFilterRef.current?.value ?? '',
                  desc: descFilterRef.current?.value ?? '',
                  artCode,
                  prodCodes: res,
                });
                setOpen(false);
              }).catch((err) => {
                console.error('err filter', err);
                setOpen(false);
              })
            } else {
              setFilters({
                prodCode: codeFilterRef.current?.value ?? '',
                desc: descFilterRef.current?.value ?? '',
                artCode,
                prodCodes: null,
              });
              setOpen(false);
            }
          }}>Filtrar {
              isLoading ? <Loader2Icon className="ml-2 animate-spin" /> : <></>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
