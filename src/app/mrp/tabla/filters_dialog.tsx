"use client"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Checkbox } from "~/components/ui/checkbox"
import { useId, useMemo, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { FixedSizeList as List } from 'react-window';
import { useWindowSize } from "@uidotdev/usehooks"
import { Settings2Icon } from "lucide-react"
import { useMRPData } from "~/components/mrp-data-provider"

export type Filters = {
    search: string
    hideAllZero: boolean
    hideProviders: Set<string>
}

export function FiltersDialog(props: {
    initialFilters: Filters
    onApply: (filters: Filters) => void
    number: number
}) {
    const [filters, setFilters] = useState<Filters>(props.initialFilters)

    const closeId = useId()

    function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
        setFilters({
            ...filters,
            search: event.target.value,
        })
    }

    function setHideAllZero(value: boolean) {
        setFilters({
            ...filters,
            hideAllZero: value,
        })
    }

    function setHideProviders(providers: Set<string>) {
        setFilters({
            ...filters,
            hideProviders: providers,
        })
    }

    function handleApply() {
        props.onApply(filters)
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="secondary">
                    <Settings2Icon className="mr-2" size={20} />
                    Filtros
                    <aside className="ml-2 bg-stone-200 px-2 py-1 rounded-full text-sm" aria-label="Cantidad de productos mostrados:">
                        {props.number}
                    </aside>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleApply()
                        document.getElementById(closeId)?.click()
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>Filtros</DialogTitle>
                    <DialogDescription>
                        Elegir que información mostrar
                    </DialogDescription>
                </DialogHeader>
                <Input
                    id="search"
                    placeholder="Buscar..."
                    className="w-full"
                    value={filters.search}
                    onChange={handleSearchChange}
                />

                <div className="flex items-center space-x-2">
                    <Checkbox id="terms"
                        checked={filters.hideAllZero}
                        onCheckedChange={setHideAllZero}
                    />
                    <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Ocultar productos sin importaciones ni ordenes
                    </label>
                </div>

                <ProvidersFilter
                    onChange={setHideProviders}
                    value={filters.hideProviders}
                />

                <DialogFooter>
                    <DialogPrimitive.Close
                        id={closeId}
                        asChild
                    >
                        <Button type="submit" onClick={handleApply}>Aplicar</Button>
                    </DialogPrimitive.Close>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}



function ProviderRow(props: { index: number, style: React.CSSProperties, value: Set<string>, onChange: (providers: Set<string>) => void }) {
    const providers = useMRPData().providers

    const provider = providers[props.index]!

    const labelId = 'label-' + provider.code

    return <div className="space-x-2 flex h-[40px] items-center" style={props.style}>
        <Checkbox id={provider.code}
            tabIndex={-1}
            checked={!props.value.has(provider.code)}
            onCheckedChange={(value) => {
                if (value) {
                    props.value.delete(provider.code)
                } else {
                    props.value.add(provider.code)
                }
                props.onChange(new Set(props.value))
            }}
        />
        <label
            id={labelId}
            tabIndex={0}
            htmlFor={provider.code}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            onKeyDown={(e) => {
                if (e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    document.getElementById(provider.code)?.click()
                    setTimeout(() => {
                        document.getElementById(labelId)?.focus()
                    }, 100)
                }
            }}
        >
            {provider.name}
        </label>
    </div>

}


function ProvidersFilter(props: {
    value: Set<string>,
    onChange: (providers: Set<string>) => void
}) {
    const providers = useMRPData().providers

    const [hideProviders, setHideProviders] = useState(props.value)

    const closeId = useId()

    function handleApply() {
        props.onChange(hideProviders)
    }

    const [search, setSearch] = useState("")

    const filteredProviders = useMemo(() => {
        return providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    }, [providers, search])

    const size = useWindowSize()

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Ocultar o mostrar proveedores</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleApply()
                        document.getElementById(closeId)?.click()
                        e.stopPropagation()
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>Proveedores</DialogTitle>
                    <DialogDescription>
                        Mostrar u ocultar proveedores
                    </DialogDescription>
                </DialogHeader>
                <Input
                    id="search_providers"
                    placeholder="Buscar..."
                    className="w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div className="grid gap-5 grid-cols-2">
                    <Button variant="outline"
                        onClick={() => {
                            setHideProviders(new Set(providers.map(p => p.code)))
                        }}
                    >Ninguno</Button>
                    <Button variant="outline"
                        onClick={() => {
                            setHideProviders(new Set())
                        }}
                    >Todos</Button>
                </div>
                <div className="max-h-[calc(100vh_-_296px)] overflow-y-auto">
                    <List
                        height={(size.height ?? window.innerHeight) - 296}
                        itemCount={filteredProviders.length}
                        itemSize={40}
                        width="100%"
                    >
                        {({ index, style }) => (
                            <ProviderRow
                                index={index}
                                style={style}
                                value={hideProviders}
                                onChange={setHideProviders}
                            />
                        )}
                    </List>
                </div>

                <DialogFooter>
                    <DialogPrimitive.Close
                        id={closeId}
                        asChild
                    >
                        <Button type="submit" onClick={handleApply}>Aplicar</Button>
                    </DialogPrimitive.Close>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}