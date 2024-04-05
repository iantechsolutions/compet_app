'use client'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'

import { XIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useMRPData } from '~/components/mrp-data-provider'
import { useOnScroll } from '~/lib/hooks'
import { cn, formatStock } from '~/lib/utils'
import type { MRPProduct } from '~/mrp_data/transform_mrp_data'

export function TargetOverlayInfoCard(props: {
    product: MRPProduct
    column: string | undefined
    onClose: () => void
    productHref: string
    trackElementId: string
}) {
    const classNames = 'fixed left-0 right-0 w-[350px] z-20'

    const { product } = props

    const stock = props.column ? product.stock_at.get(props.column) : 0
    const imported = props.column ? product.imported_quantity_by_month.get(props.column) : 0
    const ordered = props.column ? product.ordered_quantity_by_month.get(props.column) : 0
    const usedAsSupply = props.column ? product.used_as_supply_quantity_by_month.get(props.column) : 0
    // const usedAsForecast = props.column ? product.used_as_forecast_quantity_by_month.get(props.column) : 0
    const usedAsForecastSold = props.column ? product.used_as_forecast_type_sold_quantity_by_month.get(props.column) : 0
    const usedAsForecastBudgets = props.column ? product.used_as_forecast_type_budget_quantity_by_month.get(props.column) : 0

    const data = useMRPData()

    useEffect(() => {
        function listener(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                e.stopPropagation()
                props.onClose()
            }
        }

        window.addEventListener('keydown', listener)

        updateElementPosition()

        return () => {
            window.removeEventListener('keydown', listener)
        }
    }, [])

    const id = 'stock-at-month-overlay'

    useOnScroll(
        document.body,
        () => {
            updateElementPosition()
        },
        true,
    )

    const trackIdRef = useRef(props.trackElementId)

    trackIdRef.current = props.trackElementId

    useLayoutEffect(() => {
        updateElementPosition()
    }, [props.trackElementId])

    const columnRef = useRef(props.column)

    function updateElementPosition() {
        const card = document.getElementById(id)
        const element = document.getElementById(trackIdRef.current)

        if (!card) return
        if (!element) {
            card.style.display = 'none'
        } else {
            card.style.display = 'block'
        }

        const cardH = card.getBoundingClientRect().height

        const rect = element?.getBoundingClientRect()

        const h = columnRef.current ? cardH + 10 : 40

        if (!rect) return

        const { x, y } = rect

        let tx = x - 105
        let ty = y + 2 // +57

        if (tx < 5) tx = 5

        const screenH = window.document.body.clientHeight

        if (ty + h > screenH) {
            ty -= h + 60
        }

        const transform = `translate(${tx}px, ${ty}px)`
        card.style.transform = transform
    }

    if (!props.column) {
        return (
            <Link href={props.productHref}>
                <Button className={cn(classNames)} id={id} style={{ width: '150px', marginLeft: '50px' }}>
                    Abrir
                </Button>
            </Link>
        )
    }

    return (
        <div id={id} className={classNames}>
            <Card className='min-w-[300px] relative'>
                <button className='absolute top-3 right-3' onClick={props.onClose}>
                    <XIcon size={18} />
                </button>
                <CardHeader>
                    <CardTitle>{props.column}</CardTitle>
                    <CardDescription>{props.product.code}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        {/* <TableCaption>A list of your recent invoices.</TableCaption> */}
                        <TableHeader>
                            <TableRow>
                                <TableHead className='w-[100px]'>Evento</TableHead>
                                <TableHead>Cantidad</TableHead>
                                {/* <TableHead>Method</TableHead>
                            <TableHead className="text-right">Amount</TableHead> */}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className='font-medium'>Importación</TableCell>
                                <TableCell className='text-green-600 font-medium'>{formatStock(imported ?? 0)}</TableCell>
                                {/* <TableCell className="text-right">{invoice.totalAmount}</TableCell> */}
                            </TableRow>
                            <TableRow>
                                <TableCell className='font-medium'>Ventas</TableCell>
                                <TableCell className='text-blue-500 font-medium'>{formatStock(ordered ?? 0)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className='font-medium'>Armados</TableCell>
                                <TableCell className='font-medium'>{formatStock(usedAsSupply ?? 0)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className='font-medium'>Stock</TableCell>
                                <TableCell>{formatStock(stock ?? 0)}</TableCell>
                            </TableRow>
                            {data.forecastData?.forecastProfile.includeSales && (
                                <TableRow>
                                    <TableCell className='font-medium'>Forecast</TableCell>
                                    <TableCell className='text-orange-900 font-medium'>
                                        {formatStock(usedAsForecastSold ?? 0)}
                                        <span className='ml-2 text-stone-600'>Facturación</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {data.forecastData?.forecastProfile.includeBudgets && (
                                <TableRow>
                                    <TableCell className='font-medium'>Forecast</TableCell>
                                    <TableCell className='text-orange-700 font-medium'>
                                        {formatStock(usedAsForecastBudgets ?? 0)}
                                        <span className='ml-2 text-stone-600'>Presupuestos</span>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className='flex justify-between'>
                    <Link href={props.productHref} className='w-full'>
                        <Button className='w-full'>Abrir</Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    )
}
