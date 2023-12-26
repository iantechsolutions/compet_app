"use client"

import dayjs from "dayjs";
import Link from "next/link";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import DataUploadingCard from "~/components/data-uploading-card";
import { useMRPData, useMRPInvalidateAndReloadData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Title } from "~/components/title";
import { Button } from "~/components/ui/button";
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
        <Button className="mt-3 w-full max-w-[600px]" onClick={() => invalidateAndReloadData()}>Recargar datos</Button>

    </AppLayout>
}