import { Hono } from 'hono'
import { useContext } from 'react'
import { dataProviderContext } from '~/components/mrp-data-provider'
import { queryBaseMRPData } from '~/mrp_data/query_mrp_data'
import { readDataFromDB } from '~/scripts/lib/read-from-tango-db'

export const app = new Hono().basePath('/api')

app.get('/hello', (c) => {
    return c.json({ message: 'Hello, World!' })
})


app.get('/products',async (c)=>{
    const data = await queryBaseMRPData();
    const products = data.products;
    return c.json(products);
})