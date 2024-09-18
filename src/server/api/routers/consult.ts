import {  z } from 'zod'
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { queryBaseMRPData } from '~/serverfunctions';

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
        const productConsumo = new Map<string,number>()
        input.listado.forEach((product) => {
            productConsumo.set(product.productCode, product.quantity)
        })
        let unDateable = false;
        let buildDates: Date[] = [];
        let i = 0;
        console.log("productConsumo",productConsumo);
        while (i < productConsumo.size) {
            
            const product = data.products.find((product) => product.code === Array.from(productConsumo.keys())[i])
            console.log(product?.code);
            if (product) {
                // console.log("productConsumo",productConsumo);
                // const productConsumption = productConsumo.get(product.code)
                // if (productConsumption) {
                //     productConsumo.set(product.code, productConsumption + (productConsumo.get(product.code) ?? 0))
                // }
                if((productConsumo.get(product.code) ?? 0) > product.stock-product.commited) {
                    if(product.supplies && product.supplies.length > 0 ){
                        productConsumo.set(product.code, 0)
                        product.supplies.forEach(supply=>{
                            productConsumo.set(supply.supply_product_code, ((productConsumo.get(supply.product_code) ?? 0) + (supply.quantity * (productConsumo.get(product.code) ?? 0))))
                        })                        
                    }
                    else{
                        let validAmount = false;
                        product.imports.filter(impor=>new Date(String(impor.arrival_date)).getTime() > new Date().getTime()).forEach(impor=>{
                            if((productConsumo.get(product.code) ?? 0) < (product.stock - product.commited + impor.ordered_quantity) && !validAmount ){
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