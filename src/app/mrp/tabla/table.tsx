"use client"

/* eslint-disable */

import { useMRPData } from "~/components/mrp-data-provider"
import { FixedSizeList as List } from 'react-window';
import { useWindowSize } from "@uidotdev/usehooks";
import { MRPData, MRPProduct } from '~/mrp_data/transform_mrp_data';
import { cn, formatStock } from '~/lib/utils';
import { createContext, useContext, useEffect, useId, useMemo, useState } from 'react';
import { useFocus } from './focused_provider';
import { TargetOverlayInfoCard } from './overlay';
import { Filters, FiltersDialog } from './filters_dialog';
import { useOnScroll } from '~/lib/hooks';
// import { useGlobalScroll } from '~/components/global_scroll_provider';
import { useQueryState } from 'next-usequerystate'
import { useRouter } from "next/navigation";
import { NavUserData } from "~/components/nav-user-section";
import AppLayout from "~/components/applayout";
import AppSidenav from "~/components/app-sidenav";

function ProductInfoCell({ product }: { product: MRPProduct }) {

    const [currentFocus, setFocus] = useFocus()
    const id = `product-info-cell-${product.code}`

    const isFocused = currentFocus?.product.code === product.code

    return <button className={cn('border-b border-r overflow-hidden grid grid-cols-[240px_130px] bg-white z-10 md:sticky md:left-0', {
        'text-white bg-blue-500 boder-blue-500': isFocused,
    })}
        onClick={() => setFocus({ product, month: undefined, elementId: id })}
        id={id}
    >
        <div className="border-r py-2 px-2 shadow-sm m-0 text-left">
            <p className="text-md font-medium">{product.code}</p>
            <p className="text-xs whitespace-nowrap font-semibold">{product.description}</p>
        </div>
        <div className="py-2 px-2 m-0 flex items-center h-full">
            {product.additional_description}
        </div>
    </button>
}

const cellCenterBaseStyles = 'border-b border-r flex items-center w-full justify-center'

function StockCommitedCells({ product }: { product: MRPProduct }) {
    const [currentFocus, setFocus] = useFocus()

    const idStock = `stock-cell-${product.code}`
    const idCommited = `commited-cell-${product.code}`

    const stockIsFocused = currentFocus?.product.code === product.code && currentFocus?.month === undefined && currentFocus?.elementId === idStock
    const commitedIsFocused = currentFocus?.product.code === product.code && currentFocus?.month === undefined && currentFocus?.elementId === idCommited

    return <>
        <button className={cn(cellCenterBaseStyles, {
            'bg-blue-500 text-white': stockIsFocused,
        })}
            onClick={() => setFocus({ product, month: undefined, elementId: idStock })}
            id={idStock}
        >
            {formatStock(product.stock)}
        </button>
        <button className={cn(cellCenterBaseStyles, {
            'bg-blue-500 text-white': commitedIsFocused,
        })}
            onClick={() => setFocus({ product, month: undefined, elementId: idCommited })}
            id={idCommited}
        >
            {formatStock(product.commited)}
        </button>
    </>
}


function StockAtMonthCell({ product, month }: { product: MRPProduct, month: string }) {
    const stock = product.stock_at.get(month) ?? 0

    const [currentFocus, setFocus] = useFocus()

    const id = `stock-at-month-cell-${product.code}-${month}`

    return <button
        key={month}
        id={id}
        onClick={() => setFocus({ product, month, elementId: id })}
        className={cn(cellCenterBaseStyles, "top-0 text-sm px-1 relative", {
            "bg-red-200 dark:bg-red-800": stock < 0,
            "text-stone-500": stock == 0,
            "outline-dashed outline-2 outline-blue-500": currentFocus?.product.code === product.code && currentFocus?.month === month,
        })}
    >
        {formatStock(stock)}

        <div className="absolute bottom-1 left-1 flex gap-1">
            {product.imported_quantity_by_month.get(month)! > 0 && (
                <div className="w-[16px] h-[4px] rounded-full bg-green-600"></div>
            )}
            {product.ordered_quantity_by_month.get(month)! > 0 && (
                <div className="w-[16px] h-[4px] rounded-full bg-blue-600"></div>
            )}
            {product.used_as_supply_quantity_by_month.get(month)! > 0 && (
                <div className="w-[16px] h-[4px] rounded-full bg-black dark:bg-white"></div>
            )}
            {Math.floor(product.used_as_forecast_quantity_by_month.get(month)!) > 0 && (
                <div className="w-[16px] h-[4px] rounded-full bg-orange-900 opacity-25"></div>
            )}
        </div>
    </button>
}


function ListRowContainer({ children, style, id, className }: { children: React.ReactNode, style?: React.CSSProperties, className?: string, id?: string }) {
    const data = useMRPData()
    return <div
        className={className}
        id={id}
        style={{
            ...style,
            display: 'grid',
            gridTemplateColumns: `371px repeat(${data.months.length + 2}, minmax(130px, 1fr))`,
        }}>
        {children}
    </div>
}


function ListRow({ index, style }: { index: number, style: React.CSSProperties }) {
    const ctx = useContext(listRowContext)
    const products = ctx.filteredProducts

    const data = useMRPData()
    const product = products[index]!

    return <ListRowContainer key={index} style={{
        ...style,
        width: '' // para que el sticky funcione
    }}>
        <ProductInfoCell product={product} />
        <StockCommitedCells product={product} />
        {data.months.map(month => <StockAtMonthCell key={month} product={product} month={month} />)}
    </ListRowContainer>
}

const listRowContext = createContext<{
    filteredProducts: MRPProduct[]
}>({
    filteredProducts: []
})

export function Table(props: { user?: NavUserData }) {
    const data = useMRPData()

    const [filters, setFilters] = useFilters()

    const filtered = useFiltered(data, filters)

    const size = useWindowSize()

    const h = (size.height ?? 1000) - 110
    const w = size.width ?? window.innerWidth

    const headerId = useId()
    const scrollClassName = 'scroll-list-div'

    const scrolldivElement = document.getElementsByClassName(scrollClassName)[0] as HTMLElement | undefined

    useOnScroll(scrolldivElement, (scrollX, scrollY) => {
        const headerElement = document.getElementById(headerId)
        if (!headerElement) return

        headerElement.scrollTo(scrollX, 0)
    })


    const headerCellClassName = 'flex items-center justify-center font-semibold bg-stone-100 h-10 px-2'

    const [currentFocus, _] = useFocus()

    const [closedOverlay, setClosedOverlay] = useState(false)

    useEffect(() => {
        if (currentFocus) {
            setClosedOverlay(false)
        }
    }, [currentFocus])


    return <AppLayout
        title={<h1>COMPET MRP</h1>}
        user={props.user}
        sidenav={<AppSidenav />}
        hideMenuOnDesktop
        noPadding
        noUserSection
        actions={<FiltersDialog
            onApply={(f) => setFilters({ ...f })}
            initialFilters={filters}
            number={filtered.length}
        />}
    >
        {(currentFocus && !closedOverlay) && <TargetOverlayInfoCard
            trackElementId={currentFocus.elementId!}
            column={currentFocus.month}
            product={currentFocus.product}
            productHref={`/mrp/productos/${encodeURIComponent(currentFocus.product.code)}`}
            onClose={() => {
                setClosedOverlay(true)
            }}
        />}

        <ListRowContainer id={headerId} style={{ overflowX: 'hidden' }} className="shadow-md z-10">
            <div className={cn(headerCellClassName, 'justify-start flex md:sticky md:left-0')}>
                <p>Producto</p>
            </div>
            <div className={cn(headerCellClassName, 'text-sm')}>
                <p>Stock</p>
            </div>
            <div className={cn(headerCellClassName, 'text-sm')}>
                <p>Comprometido</p>
            </div>
            {data.months.map(month => <div key={month} className={cn(headerCellClassName, 'text-sm')}>
                <p>{month}</p>
            </div>)}
        </ListRowContainer>
        <div className='' style={{ height: h, width: w }}>
            <listRowContext.Provider value={{ filteredProducts: filtered }}>

                <List
                    className={scrollClassName}
                    height={h}
                    width={w}
                    itemCount={filtered.length}
                    itemSize={57}
                >
                    {ListRow}
                </List>
            </listRowContext.Provider>
        </div>
    </AppLayout>
}

function useFilters() {
    const [filtersHideAllZero, setName] = useQueryState('hide_zero', { defaultValue: true, parse: (v) => v === 'true' })
    const [filtersSearch, setSearch] = useQueryState('search', { defaultValue: '' })
    const [filtersHideProviders, setProviders] = useQueryState('hide-providers', {
        defaultValue: new Set<string>(), parse: (v) => new Set(v.split(',')),
        serialize: (v) => Array.from(v).join(','),
    })

    const filters = {
        hideAllZero: filtersHideAllZero,
        hideProviders: filtersHideProviders,
        search: filtersSearch,
    }

    function setFilters(f: Filters) {
        if (f.hideAllZero !== filters.hideAllZero) {
            setName(f.hideAllZero)
        }

        if (f.hideProviders !== filters.hideProviders) {
            setProviders(f.hideProviders)
        }

        if (f.search !== filters.search) {
            setSearch(f.search)
        }
    }

    return [filters, setFilters] as const
}

function useFiltered(data: MRPData, filters: Filters) {
    return useMemo(() => {
        let list = data.products
        const months = data.months

        if (filters.hideAllZero) {
            list = data.products.filter((product) => {
                if (product.stock != 0) return true

                for (const m of months) {
                    const stock = product.stock_at.get(m)
                    if (stock != 0) return true
                }

                return false
            })
        }

        if (filters.search) {
            list = list.filter((product) => {
                return product.code.toLowerCase().includes(filters.search.trim().toLowerCase())
                    ||
                    product.description.toLowerCase().includes(filters.search.trim().toLowerCase())
            })
        }

        if (filters.hideProviders.size > 0) {
            list = list.filter((product) => {
                for (const provider of product.providers) {
                    if (!filters.hideProviders.has(provider.provider_code)) {
                        return true
                    }
                }

                return false
            })
        }

        return list
    }, [data, filters])
}