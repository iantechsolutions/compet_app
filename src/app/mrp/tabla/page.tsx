import { getServerAuthSession } from '~/server/auth'
import { Table } from './table'

export default async function Home() {
    const session = await getServerAuthSession()

    return <Table user={session?.user} />
}
