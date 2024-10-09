"use client"
import { cn } from "~/lib/utils";
import { RouterOutputs } from "~/trpc/shared";
import { ListRowContainer } from "../consulta/consultPage";
import { Popover, PopoverTrigger,PopoverContent } from "~/components/ui/popover";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useMRPData } from "~/components/mrp-data-provider";
import { ComboboxDemo } from "~/components/combobox";
import { useEffect, useState } from "react";
import { type CutUnits } from "~/lib/types";
import Link from "next/link";
interface Props {
    cuts: RouterOutputs["cuts"]["list"];
}

export default function CutsPage({ cuts }: Props) {
    const data = useMRPData();
    const { products } = data;
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
    const [selectedCut, setSelectedCut] = useState<RouterOutputs["cuts"]["get"] | null>(null)
    const [cutsOptions, setCutsOptions] = useState<JSX.Element[]>([])
    async function getCutsOptions(prodId: string) {
        const cutsProd = await getCutByProd({ prodId })
        return cutsProd.map((cut) => <SelectItem value={cut.id.toString()}>{cut.id}</SelectItem>)
    }
    
    useEffect(() => {
        async function getCut() {
            const cutsOptions = await getCutsOptions(selectedProd)
            setCutsOptions(cutsOptions)
        }
        getCut();
        console.log("ejecutado");
    }, [selectedProd])
    async function handleEditCut() {
        if (selectedCut) {
            try {
                await editCut({
                    id: selectedCut?.id,
                    prodId: selectedProd,
                    lote: lote,
                    caja: caja,
                    location: location,
                    amount: amount,
                    measure: measure,
                    units: units as CutUnits,
                    stockPhys: 0,
                    stockTango: 0
                })
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
                measure: measure,
                units: units as CutUnits,
                stockPhys: 0,
                stockTango: 0
            })
        } catch (error) {
            console.error(error)
        }
    }
    const prodIdSet = new Set<string>()
    //obtengo todos los prodId sin repetir
    cuts.forEach((cut) => prodIdSet.add(cut.prodId))
    //obtengo todos las longitudes de recortes sin repetir 
    const cutsLengthSet = new Set<string>()
    cuts.forEach((cut) => cutsLengthSet.add(cut.measure.toString()))


    // creo un Map con los prodId y la cantidad de recortes por longitud
    const cutsMap = new Map<string, Map<string, number>>()
    for (const cut of cuts) {
        if (!cutsMap.has(cut.prodId)) {
            cutsMap.set(cut.prodId, new Map<string, number>())
        }
        const prodMap = cutsMap.get(cut.prodId)
        if (prodMap && !(prodMap.has(cut.measure.toString()))) {
            prodMap.set(cut.measure.toString(), cut.amount)
        } else if (prodMap && prodMap.has(cut.measure.toString())) {
            const currentAmount = prodMap.get(cut.measure.toString()) ?? 0;
            prodMap.set(cut.measure.toString(), currentAmount + cut.amount);
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
                                    <PopoverTrigger asChild><Button className="mx-2">Agregar Recorte</Button></PopoverTrigger>
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
                                            <div  className="pb-2">

                                            
                                            <Select defaultValue={units} onValueChange={(e: string) => setUnits(e)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar unidad"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mts">Metros</SelectItem>
                                                    <SelectItem value="ctd">Ctd</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            </div>
                                            <Button onClick={handleAddCut}>Agregar</Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Popover>
                                    <PopoverTrigger asChild><Button>Editar Recorte</Button></PopoverTrigger>
                                    <PopoverContent>
                                        <div>
                                            <Label>Codigo producto</Label>
                                            <ComboboxDemo
                                                title="Código de producto"
                                                placeholder="Seleccione un producto"
                                                value={"Agregar recorte"}
                                                onSelectionChange={(value) => {
                                                    console.log(value)
                                                }}
                                                options={products.map((product) => ({
                                                    value: product.code,
                                                    label: product.code,
                                                }))}
                                            />
                                            <Label>Recorte</Label>
                                            <Select >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar recorte" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cuts.map((cut)=>
                                                    
                                                    <SelectItem value={cut.id.toString()}>{cut.measure + " - " + cut.amount}</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <Label>Medida</Label>
                                            <Input />
                                            <Label>Cantidad</Label>
                                            <Input className="mb-2" />
                                            <Button onClick={handleEditCut}>Editar Recorte</Button>
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
                                    <PopoverTrigger asChild><Button className="mx-2">Agregar Recorte</Button></PopoverTrigger>
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
                                            <div  className="pb-2">

                                            
                                            <Select defaultValue={units} onValueChange={(e: string) => setUnits(e)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar unidad"/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mt">Metros</SelectItem>
                                                    <SelectItem value="ctd">Ctd</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            </div>
                                            <Button onClick={handleAddCut}>Agregar</Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Popover>
                                    <PopoverTrigger asChild><Button>Editar Recorte</Button></PopoverTrigger>
                                    <PopoverContent>
                                        <div>
                                            <Label>Codigo producto</Label>
                                            <ComboboxDemo
                                                title="Código de producto"
                                                placeholder="Seleccione un producto"
                                                value={"Agregar recorte"}
                                                onSelectionChange={(value) => {
                                                    console.log(value)
                                                }}
                                                options={products.map((product) => ({
                                                    value: product.code,
                                                    label: product.code,
                                                }))}
                                            />
                                            <Label>Recorte</Label>
                                            <Select >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar recorte" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {cuts.map((cut)=>
                                                    
                                                    <SelectItem value={cut.id.toString()}>{cut.measure + " - " + cut.amount}</SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <Label>Medida</Label>
                                            <Input />
                                            <Label>Cantidad</Label>
                                            <Input className="mb-2" />
                                            <Button onClick={handleEditCut}>Editar Recorte</Button>
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
                        <ListRowContainer style={{ overflowX: "hidden", gridTemplateColumns: `repeat(${Array.from(cutsLengthSet).length +1}, minmax(0, 1fr))` }} className="z-10 grid">
                            <div className={cn(headerCellClassName, "flex md:left-0")}>
                                <p>Codigo Producto</p>
                            </div>
                            {Array.from(cutsLengthSet).map((cutLength) => (
                                <div key={cutLength} className={cn(headerCellClassName, "flex md:left-0")}>
                                    <p>Longitud: {cutLength}</p>
                                </div>
                            ))}
                        </ListRowContainer>
                        {Array.from(cutsMap).map(([prodId, prodMap]) => (
                            <ListRowContainer key={prodId} style={{ overflowX: "hidden",gridTemplateColumns: `repeat(${Array.from(cutsLengthSet).length +1}, minmax(0, 1fr))`  }} className="z-10 grid">
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
