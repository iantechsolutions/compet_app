"use client"

import dayjs from "dayjs";
import Link from "next/link";
import { useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import DataUploadingCard from "~/components/data-uploading-card";
import { useMRPData, useMRPInvalidateAndReloadData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";
import { Button } from "~/components/ui/button";
import { useOnMounted } from "~/lib/hooks";
import { nullProfile } from "~/lib/nullForecastProfile";
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


type RemoteUpdateProgress = {
    value: number
    message: string
    finished: boolean
    timestamp: number
}

function RemoteUpdateComponent() {

    const [requestRemoteUpdate, setRequestRemoteUpdate] = useState<(() => void) | null>(null)
    const [remoteUpdateProgress, setRemoteUpdateProgress] = useState<RemoteUpdateProgress | null>(null)

    const invalidateAndReloadData = useMRPInvalidateAndReloadData()


    useOnMounted(() => {
        listenScaledrone()
    })

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

            setRequestRemoteUpdate(() => {
                return () => {
                    console.log('requesting remote update')

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
                    setRemoteUpdateProgress(null)
                } else {
                    setRemoteUpdateProgress(data)
                }
            })
        }
    }



    return <section>
        <Title>Base de datos de tango</Title>
        <Button
            onClick={() => {
                requestRemoteUpdate?.()
            }}
        >
            Solicitar actualización de datos
        </Button>
    </section>
}