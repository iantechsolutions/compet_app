'use client'
import { createContext, useContext } from 'react'
import { MRPProduct } from '~/mrp_data/transform_mrp_data'

const productContext = createContext<MRPProduct | null>(null)

export function ProductProvider(props: { children: React.ReactNode; product: MRPProduct }) {
    return <productContext.Provider value={props.product}>{props.children}</productContext.Provider>
}

export function useCurrentProduct() {
    const p = useContext(productContext)
    if (!p) throw new Error('No product found')
    return p
}
