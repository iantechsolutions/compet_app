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
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatStock } from "~/lib/utils";
import { CheckCheckIcon, CheckIcon, XSquareIcon } from "lucide-react";

export function SelectCRMClients() {
    const [unselected, setSelected] = useState<Set<number>>(new Set())

    const data = useMRPData()

    const quantityByClient = new Map<number, number>()
    const budgetsByClient = new Map<number, CrmBudget[]>()

    for (const budgetProduct of data.budget_products) {
        const budget = data.budgetsById.get(budgetProduct.budget_id)
        if (!budget) continue

        let qty = quantityByClient.get(budget.client_id) ?? 0
        qty += budgetProduct.quantity
        quantityByClient.set(budget.client_id, qty)

        let budgets = budgetsByClient.get(budget.client_id) ?? []
        budgets.push(budget)
        budgetsByClient.set(budget.client_id, budgets)
    }

    const crmClients = data.crm_clients

    const clientsWithBudgets = useMemo(() => {
        return crmClients.filter(client => quantityByClient.has(client.client_id))
    }, [crmClients, quantityByClient,])

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

    const Row = useCallback(({ index, style }: {
        index: number
        style: React.CSSProperties
    }) => {
        const client = clientsWithBudgets[index]!
        const qty = quantityByClient.get(client.client_id)
        const budgets = budgetsByClient.get(client.client_id)
        const id = idbase + '_' + index
        return <button id={id} tabIndex={lastFocusedIdRef.current === id ? 0 : -1} style={style} className="flex items-center px-2 h-[150px] outline-none focus:bg-stone-200 text-left"
            onClick={e => {
                if (unselected.has(client.client_id)) {
                    unselected.delete(client.client_id)
                } else {
                    unselected.add(client.client_id)
                }
                setSelected(new Set(unselected))
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
                <p className="font-medium">{client.name.trim() || `CLIENT ID: (${client.client_id})`}</p>
                <p className="text-xs">Presupuestos: {budgetsByClient.get(client.client_id)?.length}. Total presupuestado: {formatStock(quantityByClient.get(client.client_id) ?? 0)}.</p>
            </div>
            {!unselected.has(client.client_id) && <CheckIcon className="ml-auto mr-2" />}
        </button>
    }, [clientsWithBudgets, quantityByClient, budgetsByClient])


    return <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="outline">Show Dialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Cliente para forecast</AlertDialogTitle>
                <AlertDialogDescription>
                    Seleccione que clientes del CRM debe considerar para el forecast
                </AlertDialogDescription>
            </AlertDialogHeader>
            <List
                height={window.innerHeight - 200}
                itemCount={clientsWithBudgets.length}
                itemSize={70}
                width={'100%'}
            >
                {Row}
            </List>
            <AlertDialogFooter>

                <div className="flex gap-2 items-center w-full">
                    <Button variant="ghost"
                        onClick={() => setSelected(new Set())}
                    >
                        <CheckCheckIcon />
                    </Button>
                    <Button variant="ghost"
                        onClick={() => setSelected(new Set(clientsWithBudgets.map(c => c.client_id)))}
                    >
                        <XSquareIcon />
                    </Button>
                    <AlertDialogCancel className="ml-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction>Aceptar</AlertDialogAction>
                </div>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
}