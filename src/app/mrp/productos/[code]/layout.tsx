import { getServerAuthSession } from '~/server/auth'
import ProductLayoutComponent from './layout-component'

export default async function Layout(props: { children: React.ReactNode }) {
    const session = await getServerAuthSession()

    if (!session) {
        return null
    }

    return <ProductLayoutComponent user={session.user}>{props.children}</ProductLayoutComponent>
}
