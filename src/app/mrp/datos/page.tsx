import { getServerAuthSession } from "~/server/auth";
import DataSettingsPage from "./data-settings-page";
import { api } from "~/trpc/server";

export default async function Page() {
    const session = await getServerAuthSession();
    const dataInfo = await api.mrpData.mrpDataInfo.query()
    const forecastProfile = await api.forecast.currentProfile.query()

    return <DataSettingsPage
        user={session?.user}
        dataInfo={dataInfo}
        forecastProfile={forecastProfile}
    />
}