"use client"
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/shared";
import { ListRowContainer } from "../consulta/consultPage";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { ComboboxDemo } from "~/components/combobox";
import { useState } from "react";
import { type CutUnits } from "~/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
interface Props {
  cuts: RouterOutputs["cuts"]["list"];
}

export default function CutsPage({ cuts }: Props) {
  const router = useRouter();

  const { data: products, isLoading: isLoadingProducts } = api.db.getProducts.useQuery();

  const { mutateAsync: getCutByProd, isLoading: loadingGetByProd } = api.cuts.getByProdId.useMutation();
  const { mutateAsync: addCut, isLoading: loadingCreate } = api.cuts.create.useMutation();
  const { mutateAsync: editCut, isLoading: loadingEdit } = api.cuts.edit.useMutation();
  const [lote, setLote] = useState<string>("")
  const [caja, setCaja] = useState<string>("")
  const [location, setLocation] = useState<string>("")
  const [amount, setAmount] = useState<number>(0)
  const [measure, setMeasure] = useState<number>(0)
  const [units, setUnits] = useState<string>("")
  const [selectedProd, setSelectedProd] = useState<string>("")
  const [selectedCut, setSelectedCut] = useState<string | null>(null)
  const [cutsOptions, setCutsOptions] = useState<JSX.Element[]>([])

  if (isLoadingProducts || !products) {
    return (
      <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
        <Button variant="secondary" disabled>
          <Loader2Icon className="mr-2 animate-spin" /> Cargando datos...
        </Button>
      </div>
    );
  }

  async function getCutsOptions(prodId: string) {
    const cutsProd = await getCutByProd({ prodId })
    return cutsProd.map((cut) => <SelectItem value={cut.id.toString()}>{cut.id}</SelectItem>)
  }

  async function handleEditCut() {
    if (selectedCut) {
      try {
        await editCut({
          id: Number(selectedCut),
          prodId: selectedProd,
          amount: amount,
          measure: (measure * 1000),
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
        measure: (measure * 1000),
        units: units as CutUnits,
        stockPhys: 0,
        stockTango: 0
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
  cuts.forEach((cut) => cutsLengthSet.add((cut.measure / 1000).toFixed(3).replace(".", ",")))


  // creo un Map con los prodId y la cantidad de recortes por longitud
  const cutsMap = new Map<string, Map<string, number>>()
  for (const cut of cuts) {
    if (!cutsMap.has(cut.prodId)) {
      cutsMap.set(cut.prodId, new Map<string, number>())
    }
    const prodMap = cutsMap.get(cut.prodId)
    if (prodMap && !(prodMap.has((cut.measure / 1000).toFixed(3).replace(".", ",")))) {
      prodMap.set((cut.measure / 1000).toFixed(3).replace(".", ","), cut.amount)
    } else if (prodMap && prodMap.has((cut.measure / 1000).toFixed(3).replace(".", ","))) {
      const currentAmount = prodMap.get((cut.measure / 1000).toFixed(3).replace(".", ",")) ?? 0;
      prodMap.set((cut.measure / 1000).toFixed(3).replace(".", ","), currentAmount + cut.amount);
    }
  }

  for (const prodMap of cutsMap) {
    for (const cutLength of cutsLengthSet) {
      if (!prodMap[1].has(cutLength)) {
        prodMap[1].set(cutLength, 0)
      }
    }
  }

  const headerCellClassName = "flex items-center justify-center font-semibold bg-stone-100 h-10 px-2";
  const tableCellClassName = "flex items-center justify-center h-10 px-2 bg-white";

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
            <Link href="/mrp/excel-upload">
              <Button className="px-3">
                Cargar excel
              </Button>
            </Link>
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
              <Link href="/mrp/excel-upload">
                <Button className="px-3">
                  Cargar excel
                </Button>
              </Link>
            </div>
            <ListRowContainer style={{ overflowX: "hidden", gridTemplateColumns: `repeat(${Array.from(cutsLengthSet).length + 1}, minmax(0, 1fr))` }} className="z-10 grid">
              <div className={cn(headerCellClassName, "flex md:left-0")}>
                <p>Codigo Producto</p>
              </div>
              {Array.from(cutsLengthSet).map((cutLength) => (
                <div key={cutLength} className={cn(headerCellClassName, "flex md:left-0")}>
                  <p>{cutLength}</p>
                </div>
              ))}
            </ListRowContainer>
            {Array.from(cutsMap).map(([prodId, prodMap]) => (
              <ListRowContainer key={prodId} style={{ overflowX: "hidden", gridTemplateColumns: `repeat(${Array.from(cutsLengthSet).length + 1}, minmax(0, 1fr))` }} className="z-10 grid">
                <div className={cn(tableCellClassName, "flex md:left-0")}>
                  <p>{prodId}</p>
                </div>
                {Array.from(cutsLengthSet).map((cutLength) => (
                  <div key={cutLength} className={cn(tableCellClassName, "flex md:left-0")}>
                    <p>{prodMap.get(cutLength) ?? "-"}</p>
                  </div>
                ))}
              </ListRowContainer>
            ))}
          </>
        )}

    </>
  )
}
