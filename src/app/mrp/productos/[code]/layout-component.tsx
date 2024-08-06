'use client'
import { useParams } from 'next/navigation'
import AppSidenav from '~/components/app-sidenav'
import AppLayout from '~/components/applayout'
import { useMRPData } from '~/components/mrp-data-provider'
import { NavUserData } from '~/components/nav-user-section'
import { Title } from '~/components/title'
import type { MRPData, MRPProduct } from '~/mrp_data/transform_mrp_data'
import { ProductProvider } from './product_provider'

export default function ProductLayoutComponent(props: { children: React.ReactNode; user: NavUserData }) {
    const data: MRPData = useMRPData()

    const params = useParams<{ code: string }>()

    const productCode = decodeURIComponent(params?.code ?? '')

    const product: MRPProduct | null = data.products.find((p) => p.code === productCode) ?? null

    if (!product) {
        return (
            <AppLayout title={<h1>Error 404</h1>} user={props?.user} sidenav={<AppSidenav />}>
                <Title>No se encontró el pedido</Title>
                <p>No encontramos ningún producto con el número "{productCode}".</p>
            </AppLayout>
        )
    }

    return (
        <AppLayout title={<div>
            <h1>{product.description}</h1>
            <p className='text-sm'>{product.code}</p>
        </div>
        } user={props?.user} sidenav={<AppSidenav />}>
            <ProductProvider product={product}>{props.children}</ProductProvider>
        </AppLayout>
    )
}
