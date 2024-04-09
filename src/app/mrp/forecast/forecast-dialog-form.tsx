import { ListTodoIcon, Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import ListSelectionDialog from '~/components/list-selection-dialog'
import { useMRPData, useMRPInvalidateAndReloadData } from '~/components/mrp-data-provider'
import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import type { CrmBudget } from '~/lib/types'
import { formatStock } from '~/lib/utils'
import { api } from '~/trpc/react'

export default function ForecastDialogForm(props: {
    disabled?: boolean
    children: React.ReactNode
}) {
    const { mutateAsync: createProfile, isLoading: isLoading1 } = api.forecast.createProfile.useMutation()
    const { mutateAsync: applyProfile, isLoading: isLoading2 } = api.forecast.applyProfile.useMutation()

    const isLoading = isLoading1 || isLoading2

    const [name, setName] = useState('')

    const [includeSales, setIncludeSales] = useState(true)
    const [salesIncrementPercentage, setSalesIncrementPercentage] = useState('1')

    const [includeBudgets, setIncludeBudgets] = useState(true)
    const [budgetsInclusionPercentage, setBudgetsInclusionPercentage] = useState('10')

    const [clientInclusionList, setClientInclusionList] = useState<string[] | null>(null)

    const router = useRouter()
    const invalidateAndReloadData = useMRPInvalidateAndReloadData()

    const data = useMRPData()

    const quantityByClient = new Map<number, number>()
    const budgetsByClient = new Map<number, CrmBudget[]>()

    for (const budgetProduct of data.budget_products) {
        const budget = data.budgetsById.get(budgetProduct.budget_id)
        if (!budget) continue

        let qty = quantityByClient.get(budget.client_id) ?? 0
        qty += budgetProduct.quantity
        quantityByClient.set(budget.client_id, qty)

        const budgets = budgetsByClient.get(budget.client_id) ?? []
        budgets.push(budget)
        budgetsByClient.set(budget.client_id, budgets)
    }

    const crmClients = data.crm_clients

    const clientsWithBudgets = useMemo(() => {
        return crmClients.filter((client) => quantityByClient.has(client.client_id))
    }, [crmClients, quantityByClient])

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            const insertId = await createProfile({
                name,
                includeSales,
                salesIncrementFactor: Number.parseFloat(salesIncrementPercentage) / 100,
                includeBudgets,
                budgetsInclusionFactor: Number.parseFloat(budgetsInclusionPercentage) / 100,
                clientInclusionList,
            })
            await applyProfile({ id: insertId })
            invalidateAndReloadData()
        } catch (error) {
            console.error(error)
            alert(error)
        }

        router.refresh()
    }

    const formId = useId()

    return (
        <Dialog>
            <DialogTrigger asChild>{props.children}</DialogTrigger>
            <form onSubmit={onSubmit} id={formId}>
                <DialogContent className='grid gap-2'>
                    <DialogHeader>
                        <DialogTitle>Nuevo perfil de forecast</DialogTitle>
                    </DialogHeader>

                    <div>
                        <Label htmlFor='name'>Nombre del perfil</Label>
                        <Input
                            id='name'
                            name='name'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='Optimista'
                            required
                        />
                    </div>

                    <div className='flex items-center gap-2 mt-5'>
                        <Checkbox id='includeSales' checked={includeSales} onCheckedChange={(c) => setIncludeSales(!!c.valueOf())} />
                        <label
                            htmlFor='includeSales'
                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                        >
                            Incluir facturación para el forecast
                        </label>
                    </div>

                    {includeSales && (
                        <div>
                            <Label htmlFor='salesIncrementPercentage'>Porcentaje de incremento de predicción de ventas</Label>
                            <Input
                                type='number'
                                step={0.5}
                                id='salesIncrementPercentage'
                                name='salesIncrementPercentage'
                                value={salesIncrementPercentage}
                                onChange={(e) => setSalesIncrementPercentage(e.target.value)}
                                placeholder='5'
                                required
                            />
                        </div>
                    )}

                    <div className='flex items-center gap-2 mt-5'>
                        <Checkbox id='includeBudgets' checked={includeBudgets} onCheckedChange={(c) => setIncludeBudgets(!!c.valueOf())} />
                        <label
                            htmlFor='includeBudgets'
                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                        >
                            Incluir presupuestos para el forecast
                        </label>
                    </div>

                    {includeBudgets && (
                        <div>
                            <Label htmlFor='budgetsInclusionPercentage'>Porcentaje de inclusión de presupuestos</Label>
                            <Input
                                type='number'
                                step={0.5}
                                id='budgetsInclusionPercentage'
                                name='budgetsInclusionPercentage'
                                value={budgetsInclusionPercentage}
                                onChange={(e) => setBudgetsInclusionPercentage(e.target.value)}
                                placeholder='20'
                                required
                            />
                            <div className='h-5' />
                            <ListSelectionDialog
                                options={clientsWithBudgets.map((client) => ({
                                    value: client.client_id.toString(),
                                    title: client.name || client.business_name,
                                    subtitle: `Presupuestos: ${
                                        budgetsByClient.get(client.client_id)?.length
                                    }. Total presupuestado: ${formatStock(quantityByClient.get(client.client_id) ?? 0)}.`,
                                }))}
                                onApply={(selected) => {
                                    if (selected.length === clientsWithBudgets.length) {
                                        setClientInclusionList(null)
                                    } else {
                                        setClientInclusionList(selected)
                                    }
                                }}
                                defaultValues={clientInclusionList ?? clientsWithBudgets.map((client) => client.client_id.toString())}
                                title='Seleccionar clientes'
                            >
                                <Button variant='outline' className='w-full relative' type='button'>
                                    <ListTodoIcon className='mr-2 absolute left-2 opacity-75' />
                                    Presupuestos de estos clientes: (
                                    {clientInclusionList ? clientInclusionList.length : `todos: ${clientsWithBudgets.length}`})
                                </Button>
                            </ListSelectionDialog>
                        </div>
                    )}

                    <DialogFooter className='flex justify-end'>
                        {(includeBudgets || includeSales) && name.trim() && !isLoading && !props.disabled && (
                            <Button
                                className='w-full mt-2'
                                type='button'
                                onClick={() => {
                                    ;(document.getElementById(formId) as HTMLFormElement)?.requestSubmit()
                                }}
                            >
                                Crear y aplicar
                            </Button>
                        )}
                        {isLoading && (
                            <Button disabled>
                                <Loader2Icon className='animate-spin mr-2 w-full' />
                                Creando
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    )
}
