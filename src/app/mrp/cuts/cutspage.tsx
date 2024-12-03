"use client"
import { fromCutVisualMeasure, getCutVisualMeasure } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/shared";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { ComboboxDemo } from "~/components/combobox";
import { useMemo, useState } from "react";
import { type CutUnits } from "~/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterIcon, Loader2Icon } from "lucide-react";
import CutsTable from "./cuts-table";
import { useMRPData } from "~/components/mrp-data-provider";
import { CutFiltersDialog } from "./cuts-filters-dialog";
interface Props {
  cuts: RouterOutputs["cuts"]["list"];
}

export default function CutsPage({ cuts }: Props) {
  const router = useRouter();

  // const { data: products, isLoading: isLoadingProducts } = api.db.getProducts.useQuery();
  const { products, productsByCode } = useMRPData();

  // const { mutateAsync: getCutByProd, isLoading: loadingGetByProd } = api.cuts.getByProdId.useMutation();
  const { mutateAsync: addCut, isLoading: loadingCreate } = api.cuts.create.useMutation();
  const { mutateAsync: editCut, isLoading: loadingEdit } = api.cuts.edit.useMutation();
  const [lote, setLote] = useState<string>("");
  const [caja, setCaja] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [measure, setMeasure] = useState<number>(0);
  const [units, setUnits] = useState<string>("");
  const [selectedProd, setSelectedProd] = useState<string>("");
  const [selectedCut, setSelectedCut] = useState<string | null>(null);

  const [filters, setFilters] = useState<{
    prodCode: string,
    desc: string,
  }>({
    prodCode: '',
    desc: '',
  });

  const stockTangoMap = useMemo(() => {
    const res = new Map<string, number>();
    for (const prod of products) {
      res.set(prod.code, prod.stock);
    }

    return res;
  }, [products]);

  async function handleEditCut() {
    if (selectedCut) {
      try {
        await editCut({
          id: Number(selectedCut),
          prodId: selectedProd,
          amount: amount,
          measure: fromCutVisualMeasure(measure, cuts.find(v => v.id === Number(selectedCut))!.units),
        });
        router.refresh();
      } catch (error) {
        console.log(error)
      }
    }
  }
  async function handleAddCut() {
    try {
      await addCut({
        prodId: selectedProd,
        lote: lote,
        caja: caja,
        location: location,
        amount: amount,
        measure: fromCutVisualMeasure(measure, units),
        units: units as CutUnits,
        stockPhys: "0",
        stockTango: "0"
      });
      router.refresh();
    } catch (error) {
      console.error(error)
    }
  }

  const prodIdSet = new Set<string>()
  //obtengo todos los prodId sin repetir
  cuts.forEach((cut) => prodIdSet.add(cut.prodId))
  //obtengo todos las longitudes de recortes sin repetir 
  const cutsLengthSet = new Set<string>()
  cuts.forEach((cut) => cutsLengthSet.add((getCutVisualMeasure(cut.measure, cut.units)).toFixed(2).replace(".", ",")))

  return (
    <>
      {cuts.length === 0 &&
        <div>
          <div className="flex flex-row justify-between">
            <div className="mb-7">
              <Popover>
                <PopoverTrigger asChild><Button className="mx-2" disabled={loadingCreate}>Agregar Recorte {loadingCreate ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button></PopoverTrigger>
                <PopoverContent className="bg-[#f7f7f7]">
                  <div>
                    <Label>Codigo producto</Label>
                    <ComboboxDemo
                      hideIcon={true}
                      title="Código de producto"
                      classNameButton="block"
                      placeholder="Seleccione un producto"
                      value={selectedProd}
                      onSelectionChange={(value) => {
                        setSelectedProd(value)
                      }}
                      options={products.map((product) => ({
                        value: product.code,
                        label: product.code,
                      }))}
                    />
                    <Label>Lote</Label>
                    <Input defaultValue={lote} onChange={(e) => setLote(e.target.value)} />
                    <Label>Caja</Label>
                    <Input defaultValue={caja} onChange={(e) => setCaja(e.target.value)} />
                    <Label>Ubicacion</Label>
                    <Input defaultValue={location} onChange={(e) => setLocation(e.target.value)} />
                    <Label>Cantidad</Label>
                    <Input type="number" defaultValue={amount} onChange={(e) => setAmount(Number(e.target.value) ?? 0)} />
                    <Label>Medida</Label>
                    <Input type="number" defaultValue={measure} onChange={(e) => setMeasure(Number(e.target.value) ?? 0)} />
                    <Label>Unidad</Label>
                    <div className="pb-2">


                      <Select defaultValue={units} onValueChange={(e: string) => setUnits(e)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MT">Metros</SelectItem>
                          <SelectItem value="UNI">Unidades</SelectItem>
                          <SelectItem value="KITS">Kits</SelectItem>
                          <SelectItem value="PZA">Piezas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddCut} disabled={loadingCreate}>Agregar {loadingCreate ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild><Button disabled={loadingEdit}>Editar Recorte {loadingEdit ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button></PopoverTrigger>
                <PopoverContent>
                  <div>
                    <Label>Codigo producto</Label>
                    <ComboboxDemo
                      title="Código de producto"
                      placeholder="Seleccione un producto"
                      value={selectedCut ?? undefined}
                      onSelectionChange={(value) => {
                        setSelectedCut(value);
                      }}
                      options={products.map((product) => ({
                        value: product.code,
                        label: product.code,
                      }))}
                    />
                    <Label>Recorte</Label>
                    <Select onValueChange={(e: string) => setSelectedCut(e)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar recorte" />
                      </SelectTrigger>
                      <SelectContent>
                        {cuts.map((cut) =>
                          <SelectItem value={cut.id.toString()}>{cut.measure + " - " + cut.amount}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Label>Cantidad</Label>
                    <Input type="number" defaultValue={amount} onChange={(e) => setAmount(Number(e.target.value) ?? 0)} />
                    <Label>Medida</Label>
                    <Input className="mb-2" type="number" defaultValue={measure} onChange={(e) => setMeasure(Number(e.target.value) ?? 0)} />
                    <Button onClick={handleEditCut} disabled={loadingEdit}>Editar Recorte {loadingEdit ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-row">
              <Link href="/mrp/excel-upload" className="px-2">
                <Button className="px-3">
                  Cargar excel
                </Button>
              </Link>
              <CutFiltersDialog setFilters={setFilters} filters={filters}>
                <Button className="px-3">
                  <FilterIcon />
                </Button>
              </CutFiltersDialog>
            </div>
          </div>
          <h2 className="font-semibold">No hay recortes para mostrar</h2>
        </div>
      }
      {cuts.length != 0 &&
        (
          <>
            <div className="flex flex-row justify-between">
              <div className="mb-7">
                <Popover>
                  <PopoverTrigger asChild><Button className="mx-2" disabled={loadingCreate}>Agregar Recorte {loadingCreate ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button></PopoverTrigger>
                  <PopoverContent className="bg-[#f7f7f7]">
                    <div>
                      <Label>Codigo producto</Label>
                      <ComboboxDemo
                        hideIcon={true}
                        title="Código de producto"
                        classNameButton="block"
                        placeholder="Seleccione un producto"
                        value={selectedProd}
                        onSelectionChange={(value) => {
                          setSelectedProd(value)
                        }}
                        options={products.map((product) => ({
                          value: product.code,
                          label: product.code,
                        }))}
                      />
                      <Label>Lote</Label>
                      <Input defaultValue={lote} onChange={(e) => setLote(e.target.value)} />
                      <Label>Caja</Label>
                      <Input defaultValue={caja} onChange={(e) => setCaja(e.target.value)} />
                      <Label>Ubicacion</Label>
                      <Input defaultValue={location} onChange={(e) => setLocation(e.target.value)} />
                      <Label>Cantidad</Label>
                      <Input type="number" defaultValue={amount} onChange={(e) => setAmount(Number(e.target.value) ?? 0)} />
                      <Label>Medida</Label>
                      <Input type="number" defaultValue={measure} onChange={(e) => setMeasure(Number(e.target.value) ?? 0)} />
                      <Label>Unidad</Label>
                      <div className="pb-2">


                        <Select defaultValue={units} onValueChange={(e: string) => setUnits(e)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MT">Metros</SelectItem>
                            <SelectItem value="UNI">Unidades</SelectItem>
                            <SelectItem value="KITS">Kits</SelectItem>
                            <SelectItem value="PZA">Piezas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddCut} disabled={loadingCreate}>Agregar {loadingCreate ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild><Button disabled={loadingEdit}>Editar Recorte {loadingEdit ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button></PopoverTrigger>
                  <PopoverContent>
                    <div>
                      <Label>Codigo producto</Label>
                      <ComboboxDemo
                        title="Código de producto"
                        placeholder="Seleccione un producto"
                        value={selectedProd ?? undefined}
                        onSelectionChange={(value) => {
                          setSelectedProd(value);
                        }}
                        options={products.map((product) => ({
                          value: product.code,
                          label: product.code,
                        }))}
                      />
                      <Label>Recorte</Label>
                      <Select onValueChange={(e: string) => setSelectedCut(e)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar recorte" />
                        </SelectTrigger>
                        <SelectContent>
                          {cuts.filter(x => x.prodId == selectedProd).map((cut) =>
                            <SelectItem value={cut.id.toString()}>{cut.measure + " - " + cut.amount}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Label>Cantidad</Label>
                      <Input type="number" defaultValue={amount} onChange={(e) => setAmount(Number(e.target.value) ?? 0)} />
                      <Label>Medida</Label>
                      <Input className="mb-2" type="number" defaultValue={measure} onChange={(e) => setMeasure(Number(e.target.value) ?? 0)} />
                      <Button onClick={handleEditCut} disabled={loadingEdit}>Editar Recorte {loadingEdit ? <Loader2Icon className="animate-spin ml-2" size={10} /> : <></>}</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-row">
                <Link href="/mrp/excel-upload" className="px-2">
                  <Button className="px-3">
                    Cargar excel
                  </Button>
                </Link>
                <CutFiltersDialog setFilters={setFilters} filters={filters}>
                  <Button className="px-3">
                    <FilterIcon />
                  </Button>
                </CutFiltersDialog>
              </div>
            </div>
            <CutsTable cuts={cuts} productsByCode={productsByCode} filters={filters} stockTangoMap={stockTangoMap} />
          </>
        )}

    </>
  )
}
