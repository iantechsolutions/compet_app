'use client'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AppSidenav from '~/components/app-sidenav'
import AppLayout from '~/components/applayout'
import DataUploadingCard from '~/components/data-uploading-card'
import { useMRPData, useMRPDataIsUpdating, useMRPInvalidateAndReloadData } from '~/components/mrp-data-provider'
import type { NavUserData } from '~/components/nav-user-section'
import { Title } from '~/components/title'
import { Button } from '~/components/ui/button'
import { api } from '~/trpc/react'
import type { RouterOutputs } from '~/trpc/shared'
import ForecastDialogForm from './forecast-dialog-form'
import ForecastProfileCard from './forecast-profile-card'

export default function ForecastSettingsPage(props: {
    user?: NavUserData
    forecastProfiles: RouterOutputs['forecast']['listProfiles']
}) {
    const { mutateAsync: deleteProfile } = api.forecast.deleteProfile.useMutation()
    const { mutateAsync: applyProfile, isLoading: isApplyingProfile } = api.forecast.applyProfile.useMutation()
    const { mutateAsync: applyNullProfile, isLoading: isApplyingNullProfile } = api.forecast.applyNullProfile.useMutation()

    const isApplying = isApplyingProfile || isApplyingNullProfile

    const router = useRouter()

    const data = useMRPData()

    const invalidateAndReloadData = useMRPInvalidateAndReloadData()

    const isUpdating = useMRPDataIsUpdating()

    async function handleDeleteProfile(id: number) {
        if (confirm('¿Estás seguro de que quieres eliminar este perfil?')) {
            void deleteProfile({ id }).finally(() => {
                router.refresh()
            })
        }
    }

    function handleApplyProfile(id: number) {
        void applyProfile({ id })
            .then(() => {
                console.log('Applied profile!', id)
            })
            .finally(() => {
                invalidateAndReloadData()
                router.refresh()
            })
    }

    function handleApplyNullProfile() {
        void applyNullProfile()
            .then(() => {
                console.log('Applied null profile!')
            })
            .finally(() => {
                invalidateAndReloadData()
                router.refresh()
            })
    }

    let appliedProfile = data.forecastData?.forecastProfile
    if (!appliedProfile?.id) appliedProfile = undefined

    return (
        <AppLayout title={<h1>Configuración de forecast</h1>} user={props?.user} sidenav={<AppSidenav />}>
            {appliedProfile && !isUpdating && (
                <div className='mb-3'>
                    <p className='font-bold'>Perfil actual: {appliedProfile.name}</p>
                    <p className='text-xs'>
                        Porcentaje de incremento de predicción de ventas: {(appliedProfile.salesIncrementFactor * 100).toFixed(1)}%
                    </p>
                    <p className='text-xs'>
                        Porcentaje de incremento de predicción de ventas: {(appliedProfile.budgetsInclusionFactor * 100).toFixed(1)}%
                    </p>
                </div>
            )}

            <DataUploadingCard />

            <div className='mt-6' />

            <div className='flex justify-between'>
                <Title>Perfiles de forecast</Title>
                <ForecastDialogForm disabled={isUpdating}>
                    <Button disabled={isApplying} type='button' className='ml-auto'>
                        <PlusIcon className='mr-2' />
                        Crear perfil
                    </Button>
                </ForecastDialogForm>
            </div>

            <div className='mt-2'>
                <ul className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
                    <li className='items-center border border-dashed p-5 rounded-xl relative min-h-[120px]'>
                        <h2 className='font-semibold w-full'>Sin forecast</h2>
                        <div className='absolute left-5 bottom-5'>
                            {!isApplyingNullProfile && !isUpdating && (
                                <Button onClick={handleApplyNullProfile} disabled={!appliedProfile}>
                                    {appliedProfile ? 'Aplicar' : 'Aplicado'}
                                </Button>
                            )}
                            {isApplyingNullProfile && (
                                <Button disabled>
                                    <Loader2Icon className='animate-spin mr-2' />
                                    Aplicando
                                </Button>
                            )}
                        </div>
                    </li>
                    {props.forecastProfiles.map((profile) => {
                        return (
                            <ForecastProfileCard
                                key={profile.id}
                                profile={profile}
                                handleApplyProfile={handleApplyProfile}
                                handleDeleteProfile={handleDeleteProfile}
                                isLoading={isApplying ?? isUpdating}
                            />
                        )
                    })}
                </ul>
            </div>
        </AppLayout>
    )
}
