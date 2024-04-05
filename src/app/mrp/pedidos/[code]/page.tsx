import { getServerAuthSession } from '~/server/auth'
import OrderPage from './order'

export default async function Home() {
    const session = await getServerAuthSession()

    return <OrderPage user={session?.user} />
}
