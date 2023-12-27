import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useId } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ProductEventRow } from "./event_row";
import dayjs from "dayjs";
import { ProductEvent } from "~/mrp_data/transform_mrp_data";
import { cn, formatStock } from "~/lib/utils";

export function ForecastEventsRow(props: { events: ProductEvent[], month: string, stock: number }) {
    const openId = useId()

    const sum = props.events.reduce((acc, event) => acc + event.quantity, 0)

    if (props.events.length === 0 || Math.floor(sum) === 0) return <></>

    let minStock = Infinity

    for (const event of props.events) {
        if (event.productAccumulativeStock < minStock) {
            minStock = event.productAccumulativeStock
        }
    }

    return <>
        <TableRow className="bg-yellow-100" role="button" onClick={() => {
            document.getElementById(openId)?.click()
        }}>
            <TableCell>
                {formatStock(sum)}
            </TableCell>
            <TableCell colSpan={2}>
                <b>Forecast</b> Insumo / Semielaborado
            </TableCell>
            <TableCell className="underline">
                Ver detalles
            </TableCell>
            <TableCell className={cn("font-medium", {
                "text-red-500 font-medium": (props.stock - sum) < 0
            })}>
                {formatStock(props.stock - sum)}
            </TableCell>
            <TableCell>

            </TableCell>
        </TableRow>
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" id={openId} className="hidden">Insumo de forecast</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1000px]">
                <DialogHeader>
                    <DialogTitle>Forecast como insumo {props.month}</DialogTitle>
                    <DialogDescription>
                        Forecast como insumo para armado de diferentes productos
                        en el período {dayjs(props.month).format('MMMM YYYY')}.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[calc(100vh_-_200px)] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Cantidad</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Referencia</TableHead>
                                <TableHead>Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {props.events.map((event, index) => {
                                return <ProductEventRow key={index} event={event} productCode={event.productCode} nobg nodate nostate />
                            })}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter>
                    <DialogPrimitive.Close
                        asChild
                    >
                        <Button type="submit">Cerrar</Button>
                    </DialogPrimitive.Close>
                </DialogFooter>
            </DialogContent>
        </Dialog></>
}