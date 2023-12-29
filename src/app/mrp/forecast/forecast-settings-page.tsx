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
import { useMRPData, useMRPDataIsUpdating, useMRPInvalidateAndReloadData, useMRPLoadingMessage } from "~/components/mrp-data-provider";
import DataUploadingCard from "~/components/data-uploading-card";
import { SelectCRMClients } from "./select-crm-clients";

export default function ForecastSettingsPage(props: { user?: NavUserData, forecastProfiles: RouterOutputs['forecast']['listProfiles'] }) {
    const { mutateAsync: deleteProfile } = api.forecast.deleteProfile.useMutation()
    const { mutateAsync: applyProfile, isLoading: isApplyingProfile } = api.forecast.applyProfile.useMutation()
    const { mutateAsync: applyNullProfile, isLoading: isApplyingNullProfile } = api.forecast.applyNullProfile.useMutation()

    const isApplying = isApplyingProfile || isApplyingNullProfile

    const router = useRouter()

    const data = useMRPData()

    const invalidateAndReloadData = useMRPInvalidateAndReloadData()

    const isUpdating = useMRPDataIsUpdating()

    function handleDeleteProfile(id: number) {
        if (confirm('¿Estás seguro de que quieres eliminar este perfil?')) {
            deleteProfile({ id }).finally(() => {
                router.refresh()
            })
        }
    }

    function handleApplyProfile(id: number) {
        applyProfile({ id }).then(() => {
            console.log("Applied profile!", id)
        }).finally(() => {
            invalidateAndReloadData()
            router.refresh()
        })
    }

    function handleApplyNullProfile() {
        applyNullProfile().then(() => {
            console.log("Applied null profile!")
        }).finally(() => {
            invalidateAndReloadData()
            router.refresh()
        })
    }

    let appliedProfile = data.forecastData?.forecastProfile
    if (!appliedProfile?.id) appliedProfile = undefined

    return <AppLayout
        title={<h1>Configuración de forecast</h1>}
        user={props?.user}
        sidenav={<AppSidenav />}
    >

        {(appliedProfile && !isUpdating) && <div className="mb-3">
            <p className="font-bold">Perfil actual: {appliedProfile.name}</p>
            <p className="text-xs">Porcentaje de incremento de prediccón de ventas: {(appliedProfile.salesIncrementFactor * 100).toFixed(1)}%</p>
            <p className="text-xs">Porcentaje de incremento de prediccón de ventas: {(appliedProfile.budgetsInclusionFactor * 100).toFixed(1)}%</p>
        </div>}

        <DataUploadingCard />

        <CreateProfileForm disabled={isUpdating} />

        <div className="mt-6" />

        <Title>Perfiles de forecast</Title>

        <div className="mt-2 max-w-[600px]">
            <ul>

                <li className="flex items-center border-l-4 border-l-stone-500 pl-2 mb-4">
                    <h2 className="font-semibold w-full">Sin forecast</h2>
                    {(!isApplyingNullProfile && !isUpdating) && <Button onClick={handleApplyNullProfile} disabled={!appliedProfile}>{appliedProfile ? 'Aplicar' : 'Aplicado'}</Button>}
                    {isApplyingNullProfile && <Button disabled><Loader2Icon className="animate-spin mr-2" />Aplicando</Button>}

                </li>
                {props.forecastProfiles.map(profile => {

                    return <li key={profile.id} className="flex items-center border-l-4 border-l-stone-500 pl-2 mb-4">
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
                            disabled={isApplying || isUpdating}
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

function CreateProfileForm(props: { disabled?: boolean }) {
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

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()

        try {
            const insertId = await createProfile({
                name,
                includeSales,
                salesIncrementFactor: parseFloat(salesIncrementPercentage) / 100,
                includeBudgets,
                budgetsInclusionFactor: parseFloat(budgetsInclusionPercentage) / 100,
                clientInclusionList,
            })
            await applyProfile({ id: parseInt(insertId) })
            invalidateAndReloadData()
        } catch (error) {
            console.error(error)
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
                        placeholder="Optimista"
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
                    <Label htmlFor="salesIncrementPercentage">Porcentaje de incremento de predicción de ventas</Label>
                    <Input
                        type="number"
                        step={0.5}
                        id="salesIncrementPercentage"
                        name="salesIncrementPercentage"
                        value={salesIncrementPercentage}
                        onChange={e => setSalesIncrementPercentage(e.target.value)}
                        placeholder="5"
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
                    <Label htmlFor="budgetsInclusionPercentage">Porcentaje de inclusión de presupuestos</Label>
                    <Input
                        type="number"
                        step={0.5}
                        id="budgetsInclusionPercentage"
                        name="budgetsInclusionPercentage"
                        value={budgetsInclusionPercentage}
                        onChange={e => setBudgetsInclusionPercentage(e.target.value)}
                        placeholder="20"
                        required
                    />
                    {/* <SelectCRMClients /> */}
                </div>}

            </CardContent>
            <CardFooter className="flex justify-end">
                {((includeBudgets || includeSales) && name.trim() && !isLoading && !props.disabled) && <Button type="submit">Crear y aplicar</Button>}
                {isLoading && <Button disabled><Loader2Icon className="animate-spin mr-2" />Creando</Button>}
            </CardFooter>
        </form>
    </Card>
}