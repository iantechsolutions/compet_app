"use client"
import AppLayout from "~/components/applayout";
import { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import AppSidenav from "~/components/app-sidenav";
import { RouterOutputs } from "~/trpc/shared";
import { api } from "~/trpc/react";
import { useState } from "react";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Title } from "~/components/title";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { useMRPInvalidateAndReloadData } from "~/components/mrp-data-provider";

export default function ForecastSettingsPage(props: { user?: NavUserData, forecastProfiles: RouterOutputs['forecast']['listProfiles'] }) {
    const { mutateAsync: deleteProfile } = api.forecast.deleteProfile.useMutation()
    const { mutateAsync: applyProfile, isLoading: isApplying } = api.forecast.applyProfile.useMutation()
    const router = useRouter()

    const invalidateAndReloadData = useMRPInvalidateAndReloadData()

    function handleDeleteProfile(id: number) {
        if (confirm('¿Estás seguro de que quieres eliminar este perfil?')) {
            deleteProfile({ id }).finally(() => {
                router.refresh()
            })
        }
    }

    function handleApplyProfile(id: number) {
        applyProfile({ id }).then(() => {

        }).finally(() => {
            invalidateAndReloadData()
            router.refresh()
        })
    }

    return <AppLayout
        title={<h1>Configuración de forecast</h1>}
        user={props?.user}
        sidenav={<AppSidenav />}
    >
        <CreateProfileForm />

        <div className="mt-6" />

        <Title>Perfiles de forecast</Title>

        <div className="mt-2 max-w-[600px]">
            <ul>
                {props.forecastProfiles.map(profile => {

                    return <li role="button" className="flex items-center border-l-4 border-l-stone-500 pl-2 mb-4">
                        <div className="w-full">
                            <h2 className="font-semibold">{profile.name}</h2>
                            {profile.includeSales && <p className="text-sm font-medium">
                                Incremento ventas: {(profile.salesIncrementFactor * 100).toFixed(1)}%
                            </p>}
                            {profile.includeBudgets && <p className="text-sm font-medium">
                                Inclusión de presupuestos: {(profile.budgetsInclusionFactor * 100).toFixed(1)}%
                            </p>}
                            <p className="text-xs">{dayjs(profile.createdAt).format('DD/MM/YYYY - HH:mm')}</p>
                        </div>
                        {!profile.current && <button className="p-2 hover:bg-stone-100 active:bg-stone-200 mr-2"
                            onClick={() => handleDeleteProfile(profile.id)}
                        >
                            <Trash2Icon size={16} className="text-red-500" />
                        </button>}
                        {!profile.current && <Button
                            disabled={isApplying}
                            onClick={() => handleApplyProfile(profile.id)}
                        >Aplicar</Button>}
                        {profile.current && <Button
                            disabled
                        >Aplicado</Button>}
                    </li>
                })}
            </ul>
        </div>

    </AppLayout>
}

function CreateProfileForm() {
    const { mutateAsync: createProfile, isLoading } = api.forecast.createProfile.useMutation()

    const [name, setName] = useState('')

    const [includeSales, setIncludeSales] = useState(true)
    const [salesIncrementPercentage, setSalesIncrementPercentage] = useState('1')

    const [includeBudgets, setIncludeBudgets] = useState(true)
    const [budgetsInclusionPercentage, setBudgetsInclusionPercentage] = useState('10')

    const [clientInclusionList, setClientInclusionList] = useState<string[] | null>(null)

    const router = useRouter()
    const invalidateAndReloadData = useMRPInvalidateAndReloadData()

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            await createProfile({
                name,
                includeSales,
                salesIncrementFactor: parseFloat(salesIncrementPercentage) / 100,
                includeBudgets,
                budgetsInclusionFactor: parseFloat(budgetsInclusionPercentage) / 100,
                clientInclusionList,
            })
            invalidateAndReloadData()
        } catch (error) {
            alert(error)
        }

        router.refresh()
    }

    return <Card className="max-w-[600px]">
        <CardHeader>
            <CardTitle>Nueva config. de forecast</CardTitle>
        </CardHeader>
        <form onSubmit={onSubmit}>
            <CardContent className="grid gap-2">

                <div>
                    <Label htmlFor="name">Nombre del perfil</Label>
                    <Input
                        id="name"
                        name="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="flex items-center gap-2 mt-5">
                    <Checkbox id="includeSales" checked={includeSales} onCheckedChange={c => setIncludeSales(!!c.valueOf())} />
                    <label
                        htmlFor="includeSales"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Incluir facturación para el forecast
                    </label>
                </div>

                {includeSales && <div>
                    <Label htmlFor="salesIncrementPercentage">Porcentaje de incremento de ventas</Label>
                    <Input
                        type="number"
                        step={0.5}
                        id="salesIncrementPercentage"
                        name="salesIncrementPercentage"
                        value={salesIncrementPercentage}
                        onChange={e => setSalesIncrementPercentage(e.target.value)}
                        required
                    />
                </div>}

                <div className="flex items-center gap-2 mt-5">
                    <Checkbox id="includeBudgets" checked={includeBudgets} onCheckedChange={c => setIncludeBudgets(!!c.valueOf())} />
                    <label
                        htmlFor="includeBudgets"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        Incluir presupuestos para el forecast
                    </label>
                </div>

                {includeBudgets && <div>
                    <Label htmlFor="budgetsInclusionPercentage">Porcentaje de incremento de ventas</Label>
                    <Input
                        type="number"
                        step={0.5}
                        id="budgetsInclusionPercentage"
                        name="budgetsInclusionPercentage"
                        value={budgetsInclusionPercentage}
                        onChange={e => setBudgetsInclusionPercentage(e.target.value)}
                        required
                    />
                </div>}

            </CardContent>
            <CardFooter className="flex justify-end">
                {((includeBudgets || includeSales) && name.trim() && !isLoading) && <Button type="submit">Crear y aplicar</Button>}
                {isLoading && <Button disabled><Loader2Icon className="animate-spin mr-2" />Creando</Button>}
            </CardFooter>
        </form>
    </Card>
}