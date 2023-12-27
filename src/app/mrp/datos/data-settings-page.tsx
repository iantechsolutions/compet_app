"use client"

import dayjs from "dayjs";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import DataUploadingCard from "~/components/data-uploading-card";
import { useMRPData, useMRPInvalidateAndReloadData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useGlobalState, useOnMounted } from "~/lib/hooks";
import { nullProfile } from "~/lib/nullForecastProfile";
import { cn } from "~/lib/utils";
import { RouterOutputs } from "~/trpc/shared";

export default function DataSettingsPage(props: {
    user?: NavUserData,
    dataInfo: RouterOutputs['mrpData']['mrpDataInfo'],
    forecastProfile: RouterOutputs['forecast']['currentProfile'],
}) {
    const date = dayjs(props.dataInfo.exportDate)
    const data = useMRPData()
    const invalidateAndReloadData = useMRPInvalidateAndReloadData()
    const forecastProfile = props.forecastProfile ?? nullProfile

    const dataMismatch = data.forecastData?.forecastProfile.id != forecastProfile.id || data.dataExportUrl != props.dataInfo.exportURL

    return <AppLayout
        title={<h1>Config. de datos</h1>}
        user={props.user}
        sidenav={<AppSidenav />}
    >
        <DataUploadingCard />

        <Title>Origen de datos</Title>

        <p>
            Último export de datos{` `}
            <b>{date.format("DD/MM/YYYY")}</b>
            {` `}a las{` `}
            <b>{date.format("HH:mm:ss")}</b>
        </p>
        <p>
            Archivo de datos:{' '}
            <Link href={props.dataInfo.exportURL} className="underline font-medium text-blue-500" target="_blank">
                {props.dataInfo.exportURL}
            </Link>
        </p>
        <p>Perfil de forecast: <b>{forecastProfile.name} (id: {forecastProfile.id ?? 0})</b></p>
        <Title className="mt-5">Mostrando actualmente</Title>
        <Link href={data.dataExportUrl} className="underline font-medium text-blue-500 text-sm" target="_blank">
            {data.dataExportUrl}
        </Link>
        <p>Perfil de forecast: <b>{data.forecastData!.forecastProfile.name} (id: {data.forecastData!.forecastProfile.id ?? 0})</b></p>
        <p>
            Fecha del export:{` `}
            <b>{dayjs(data.dataExportDate).format("DD/MM/YYYY")}</b>
            {` `}a las{` `}
            <b>{dayjs(data.dataExportDate).format("HH:mm:ss")}</b>
        </p>
        {dataMismatch && <div className="mt-5">
            <p className="font-semibold text-red-500">
                Los datos mostrados no coinciden con los datos exportados. Recargue los datos.
            </p>
        </div>}
        {!dataMismatch && <div className="mt-5">
            <p className="font-semibold text-green-500">
                Datos sincronizados correctamente.
            </p>
        </div>}
        <Button className="mt-3 w-full max-w-[600px]" onClick={() => invalidateAndReloadData()} variant={dataMismatch ? 'default' : 'secondary'}>Recargar datos</Button>

        <hr className="my-5 block" />

        <RemoteUpdateComponent />
    </AppLayout>
}


export type RemoteUpdateProgress = {
    value: number
    message: string
    finished: boolean
    timestamp: number
    error: boolean
}

function RemoteUpdateComponent() {

    const [requestRemoteUpdate, setRequestRemoteUpdate] = useGlobalState<(() => void) | null>('mrp.data.requestRemoteUpdate', null)
    const [remoteUpdateProgress, _setRemoteUpdateProgress] = useGlobalState<RemoteUpdateProgress | null>('mrp.data.remoteUpdateProgress', null)
    const progressRef = useRef<RemoteUpdateProgress | null>(remoteUpdateProgress)

    const setRemoteUpdateProgress = (value: RemoteUpdateProgress | null) => {
        progressRef.current = value
        _setRemoteUpdateProgress(value)
    }

    const invalidateAndReloadData = useMRPInvalidateAndReloadData()

    const timerRef = useRef<any>(0)

    useOnMounted(() => {
        listenScaledrone()
    })

    const router = useRouter()

    async function listenScaledrone() {
        const rc = await fetch('/api/scaledrone_channel')
        const { channel } = await rc.json()

        const drone = new Scaledrone(channel);

        drone.on('open', async function (error) {
            if (error) {
                console.error(error)
                return
            }

            const rt = await fetch('/api/scaledrone_jwt?client_id=' + drone.clientId)
            const { token } = await rt.json()

            drone.authenticate(token)
        })

        drone.on('authenticate', function (error) {
            if (error) {
                console.error(error)
            } else {
                console.log('authenticated')

                onReady()
            }
        })

        drone.on('error', function (error) {
            console.error(error)
        })

        function onReady() {
            console.log('messaging ready')

            const room = drone.subscribe('update_progress');

            drone.publish({
                room: 'request_data_update',
                message: "null",
            })

            setRequestRemoteUpdate(() => {
                return () => {
                    console.log('requesting remote update')

                    clearTimeout(timerRef.current!)

                    timerRef.current = setTimeout(() => {
                        if (progressRef.current?.value != 0) return

                        setRemoteUpdateProgress({
                            value: 0,
                            message: 'Error de conexión (el servidor no responde)',
                            finished: false,
                            timestamp: Date.now(),
                            error: true
                        })
                    }, 15000)

                    setRemoteUpdateProgress({
                        value: 0,
                        message: 'Esperando información del servidor',
                        finished: false,
                        timestamp: Date.now(),
                        error: false
                    })

                    drone.publish({
                        room: 'request_data_update',
                        message: Date.now().toString()
                    })
                }
            })

            room.on('message', async message => {
                const data = JSON.parse(message.data) as RemoteUpdateProgress
                if (data.finished) {
                    invalidateAndReloadData()
                    router.refresh()
                    setTimeout(() => {
                        setRemoteUpdateProgress(null)
                    }, 200)
                } else {
                    setRemoteUpdateProgress(data)
                }
            })
        }
    }



    return <section className="w-full max-w-[600px]">
        <Title>Base de datos de tango</Title>
        {(!remoteUpdateProgress || remoteUpdateProgress.error) && <Button
            className="mb-5"
            onClick={() => {
                requestRemoteUpdate?.()
            }}
            disabled={!requestRemoteUpdate}
        >
            Solicitar actualización de datos
        </Button>}

        {remoteUpdateProgress && <Card className="flex p-5 gap-5 items-center break-words">
            {!remoteUpdateProgress.error && <Loader2Icon className="mr-2 animate-spin" />}
            <p
                className={cn('font-medium', {
                    'text-red-500': remoteUpdateProgress?.error
                })}
            >
                {progressRef.current?.message}
            </p>
        </Card>}
    </section>
}