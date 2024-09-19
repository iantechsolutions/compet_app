import { getServerAuthSession } from '~/server/auth'
import { api } from '~/trpc/server'
import DataSettingsPage from './data-settings-page'
import { getUserSetting, setUserSetting } from '~/lib/settings'

export default async function Page() {
    const session = await getServerAuthSession()
    const dataInfo = await api.mrpData.mrpDataInfo.query()
    const forecastProfile = await api.forecast.currentProfile.query()
    const mails = await getUserSetting<string[]>('mrp.mails',"");
    return <DataSettingsPage user={session?.user} dataInfo={dataInfo} forecastProfile={forecastProfile} mails={mails}/>
}
