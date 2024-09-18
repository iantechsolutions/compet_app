import {  z } from 'zod'
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { queryBaseMRPData } from '~/serverfunctions';
import { excludeProducts } from '../constants';
import { ForecastProfile, listAllEventsWithSupplyEvents, listProductsEvents, mapData } from '~/mrp_data/transform_mrp_data';
import { queryForecastData } from '~/mrp_data/query_mrp_forecast_data';
import { getUserSetting } from '~/lib/settings';
import { getServerAuthSession } from '~/server/auth';
import { db } from '~/server/db';
import { forecastProfiles } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { nullProfile } from '~/lib/nullForecastProfile';

// import { excludeProducts } from 'constants';

export const consultRouter = createTRPCRouter({
    isConstructionPossible: protectedProcedure.input(
        z.object({
            listado: z.array(z.object({
                productCode: z.string(),
                quantity: z.number(),
            }))
        })
    )
    .mutation(async ({ ctx, input }) => {
        const data = await queryBaseMRPData();
        const session = await getServerAuthSession()
        const forecastProfileId = await getUserSetting<number>('mrp.current_forecast_profile', session?.user.id ?? "")

        let forecastProfile: ForecastProfile | null =
            forecastProfileId != null
                ? (await db.query.forecastProfiles.findFirst({
                    where: eq(forecastProfiles.id, forecastProfileId),
                })) ?? null
                : null

        if (!forecastProfile) {
            forecastProfile = nullProfile
        }
        const forecastData = await queryForecastData(forecastProfile, data)
        const evolvedData = mapData(data, forecastData)
        const events = listAllEventsWithSupplyEvents(evolvedData)

        const eventsByProductCode = listProductsEvents(evolvedData, events)
        const productConsumo = new Map<string,number>()
        input.listado.forEach((product) => {
            productConsumo.set(product.productCode, product.quantity)
        })
        let unDateable = false;
        let buildDates: Date[] = [];
        let i = 0;
        console.log("productConsumo",productConsumo);
        while (i < productConsumo.size) {
            const curatedProducts = data.products.filter(product =>
                !excludeProducts.some(excludedProduct => product.code.toLowerCase().startsWith(excludedProduct))
            )
            const product = curatedProducts.find((product) => product.code === Array.from(productConsumo.keys())[i])
            console.log(product?.code);
            if (product) {
                const expiredNotImportEvents = (eventsByProductCode.get(product.code) ?? []).filter(
                    (event) => event.expired && event.type !== 'import',
                )
                const commited = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0)
        



                console.log(product.stock,commited);
                // console.log("productConsumo",productConsumo);
                // const productConsumption = productConsumo.get(product.code)
                // if (productConsumption) {
                //     productConsumo.set(product.code, productConsumption + (productConsumo.get(product.code) ?? 0))
                // }
                if((productConsumo.get(product.code) ?? 0) > product.stock - commited) {
                    if(product.supplies && product.supplies.length > 0 ){
                        // productConsumo.set(product.code, 0)
                        product.supplies.forEach(supply=>{
                            console.log("supply",supply.quantity);
                            productConsumo.set(supply.supply_product_code, ((productConsumo.get(supply.product_code) ?? 0) + (supply.quantity * ((productConsumo.get(product.code) ?? 0) - (product.stock - commited )))))
                        })                        
                    }
                    else{
                        let validAmount = false;
                        product.imports.filter(impor=>new Date(String(impor.arrival_date)).getTime() > new Date().getTime()).forEach(impor=>{
                            if((productConsumo.get(product.code) ?? 0) < (product.stock - commited + impor.ordered_quantity) && !validAmount ){
                                console.log("arrival_date", impor.arrival_date);
                                const tempDate = new Date(String(impor.arrival_date))
                                buildDates.push(tempDate);
                                validAmount = true;
                            }
                        })
                        if(!validAmount){
                            unDateable = true;
                        }
                    }
                }
            }
            i++;
        }
        console.log("productConsumo",productConsumo);
        if (buildDates.length > 0 || unDateable){
            return {
                isPossible: false,
                buildDate: unDateable ? null : Math.max(...buildDates.map(date => date.getTime()))
            }
        }
        else{
            return{
                isPossible: true,
            }
        }
    })
})