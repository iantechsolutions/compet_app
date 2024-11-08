"use client";
import { useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { CutsFilterDispatch, CutsFilters } from "./cuts-table";
import { Button } from "~/components/ui/button";

export function CutFiltersDialog({
  children,
  setFilters,
  filters
}: {
  children: ReactNode,
  setFilters: CutsFilterDispatch,
  filters: CutsFilters
}) {
  const codeFilterRef = useRef<HTMLInputElement>(null);
  const descFilterRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
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
              Descripción de producto
            </Label>
            <Input ref={descFilterRef} id="code" placeholder="AZUL" defaultValue={filters.desc} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={() => {
            setFilters({
              prodCode: codeFilterRef.current?.value ?? '',
              desc: descFilterRef.current?.value ?? '',
            });
            setOpen(false);
          }}>Filtrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
