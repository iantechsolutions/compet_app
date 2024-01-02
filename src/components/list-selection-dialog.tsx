import { useMRPData } from "~/components/mrp-data-provider"
import { CrmBudget } from "~/lib/types"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { FixedSizeList as List } from 'react-window';
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from "react";
import { CheckCheckIcon, CheckIcon, XSquareIcon } from "lucide-react";
import { Input } from "./ui/input";


export type ListSelectionDialogProps = {
    children: React.ReactNode
    title: React.ReactNode
    options: {
        title: string
        subtitle: string
        value: string
    }[],
    onApply: (selected: string[]) => void
    defaultValues?: Iterable<string>
    onCanceled?: () => void
    height?: number
}


const rowsContext = createContext<{
    options: ListSelectionDialogProps['options']
    selected: Set<string>
    onClickOption: (option: string) => void
}>({
    options: [],
    selected: new Set(),
    onClickOption: () => { }
})



export default function ListSelectionDialog(props: ListSelectionDialogProps) {
    const [selected, setSelected] = useState(new Set(props.defaultValues ?? []))

    const allValuesList = useMemo(() => props.options.map(o => o.value), [props.options])

    const [filter, setFilter] = useState('')

    const idbase = useId()

    const focusedIdRef = useRef<string | null>(null)
    const lastFocusedIdRef = useRef<string>(idbase + '_0')

    function focusNext() {
        if (!focusedIdRef.current) return
        const element = document.getElementById(focusedIdRef.current)
        const nextSibling = element?.nextElementSibling as HTMLElement

        nextSibling?.focus()
    }

    function focusPrevious() {
        if (!focusedIdRef.current) return
        const element = document.getElementById(focusedIdRef.current)
        const previousSibling = element?.previousElementSibling as HTMLElement

        previousSibling?.focus()
    }

    const filteredOptions = useMemo(() => {
        if (!filter.trim()) return props.options
        return props.options.filter(o => {
            if (o.title?.toLowerCase().includes(filter.toLowerCase())) return true
            if (o.subtitle?.toLowerCase().includes(filter.toLowerCase())) return true
            if (o.value?.toString().toLowerCase().includes(filter.toLowerCase())) return true
            return false
        })
    }, [props.options, filter])

    const Row = useCallback(({ index, style }: {
        index: number
        style: React.CSSProperties
    }) => {
        const option = filteredOptions[index]
        if (!option) return null

        const id = idbase + '_' + index
        return <button id={id} tabIndex={lastFocusedIdRef.current === id ? 0 : -1} style={style} className="flex items-center px-2 h-[150px] outline-none focus:bg-stone-200 text-left"
            onClick={e => {
                if (selected.has(option.value)) {
                    selected.delete(option.value)
                } else {
                    selected.add(option.value)
                }
                setSelected(new Set(selected))
                setTimeout(() => {
                    if (!focusedIdRef.current) return
                    const element = document.getElementById(focusedIdRef.current)
                    element?.focus()
                }, 20)
            }}

            onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    focusNext()
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    focusPrevious()
                }
            }}

            onFocus={e => {
                focusedIdRef.current = e.target.id
                lastFocusedIdRef.current = e.target.id
            }}

            onBlur={e => {
                if (focusedIdRef.current !== e.target.id) return
                focusedIdRef.current = null
            }}
        >
            <div>
                <p className="font-medium">{option.title}</p>
                {option.subtitle && <p className="text-xs">{option.subtitle}</p>}
            </div>
            {selected.has(option.value) && <CheckIcon className="ml-auto mr-2" />}
        </button>
    }, [
        props.options,
        selected
    ])



    return <AlertDialog>
        <AlertDialogTrigger asChild>
            {props.children}
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{props.title}</AlertDialogTitle>
                <Input
                    name="search"
                    placeholder="Buscar"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            </AlertDialogHeader>
            {/* <List
                height={window.innerHeight - 220}
                itemCount={filteredOptions.length}
                itemSize={70}
                width={'100%'}
            >
                {Row}
            </List> */}
            <rowsContext.Provider
                value={{
                    options: filteredOptions,
                    selected,
                    onClickOption: option => {
                        if (selected.has(option)) {
                            selected.delete(option)
                        } else {
                            selected.add(option)
                        }
                        setSelected(new Set(selected))
                    }
                }}
            >
                <ListRender />
            </rowsContext.Provider>
            <AlertDialogFooter>

                <div className="flex gap-2 items-center w-full">
                    <Button variant="ghost"
                        onClick={() => setSelected(new Set(allValuesList))}
                    >
                        <CheckCheckIcon />
                    </Button>
                    <Button variant="ghost"
                        onClick={() => setSelected(new Set())}
                    >
                        <XSquareIcon />
                    </Button>
                    <AlertDialogCancel className="ml-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            props.onApply(Array.from(selected) as any)
                        }}
                    >Aceptar</AlertDialogAction>
                </div>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
}

function ListRender() {
    const ctx = useContext(rowsContext)
    const options = ctx.options

    return <List
        height={window.innerHeight - 220}
        itemCount={options.length}
        itemSize={70}
        width={'100%'}
    >
        {Row}
    </List>
}


function Row({ index, style }: {
    index: number
    style: React.CSSProperties
}) {
    const ctx = useContext(rowsContext)
    const options = ctx.options

    const option = options[index]
    if (!option) return null

    return <button
        style={style}
        className="flex items-center px-2 h-[150px] outline-none focus:bg-stone-200 text-left"
        onClick={e => {
            ctx.onClickOption(option.value)
        }}

        onKeyDown={e => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                ((e.target as HTMLElement).nextElementSibling as HTMLElement | undefined)?.focus()
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                ((e.target as HTMLElement).previousElementSibling as HTMLElement | undefined)?.focus()
            }
        }}

    // onFocus={e => {
    //     focusedIdRef.current = e.target.id
    //     lastFocusedIdRef.current = e.target.id
    // }}

    // onBlur={e => {
    //     if (focusedIdRef.current !== e.target.id) return
    //     focusedIdRef.current = null
    // }}
    >
        <div>
            <p className="font-medium">{option.title}</p>
            {option.subtitle && <p className="text-xs">{option.subtitle}</p>}
        </div>
        {ctx.selected.has(option.value) && <CheckIcon className="ml-auto mr-2" />}
    </button>
}