import { getServerAuthSession } from '~/server/auth'
import ConsultsPage from './consultPage'


export default async function Home() {
    const session = await getServerAuthSession()

    return <ConsultsPage  />
}
