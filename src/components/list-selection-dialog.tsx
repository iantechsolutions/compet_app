import { useMRPData } from "~/components/mrp-data-provider"
import { CrmBudget } from "~/lib/types"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
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
        title: React.ReactNode
        subtitle: React.ReactNode
        value: string
    }[],
    onApply: (selected: string[]) => void
    defaultValues?: Iterable<string>
    onCanceled?: () => void
    height?: number
    readOnly?: boolean
}


const rowsContext = createContext<{
    options: ListSelectionDialogProps['options']
    selected: Set<string>
    onClickOption: (option: string) => void
}>({
    options: [],
    selected: new Set(),
    onClickOption: () => void 0
})



export default function ListSelectionDialog(props: ListSelectionDialogProps) {
    const [selected, setSelected] = useState(new Set(props.defaultValues ?? []))

    const allValuesList = useMemo(() => props.options.map(o => o.value), [props.options])

    const [filter, setFilter] = useState('')

    const filteredOptions = useMemo(() => {
        if (!filter.trim()) return props.options
        return props.options.filter(o => {
            if (o.title?.toString().toLowerCase().includes(filter.toLowerCase())) return true
            if (o.subtitle?.toString().toLowerCase().includes(filter.toLowerCase())) return true
            if (o.value?.toString().toLowerCase().includes(filter.toLowerCase())) return true
            return false
        })
    }, [props.options, filter])


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

            <rowsContext.Provider
                value={{
                    options: filteredOptions,
                    selected,
                    onClickOption: option => {
                        if (props.readOnly) return;

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
            {!props.readOnly && <AlertDialogFooter>

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
                            props.onApply(Array.from(selected) as unknown as string[])
                        }}
                    >Aceptar</AlertDialogAction>
                </div>
            </AlertDialogFooter>}
            {props.readOnly && <AlertDialogFooter>
                <AlertDialogCancel className="w-full">Cerrar</AlertDialogCancel>
            </AlertDialogFooter>}
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

    >
        <div>
            <p className="font-medium">{option.title}</p>
            {option.subtitle && <p className="text-xs">{option.subtitle}</p>}
        </div>
        {ctx.selected.has(option.value) && <CheckIcon className="ml-auto mr-2" />}
    </button>
}