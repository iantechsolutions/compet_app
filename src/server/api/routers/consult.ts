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
        let i = 0;
        let unDateable = false;
        let buildDates: Date[] = [];
        for (i = 0; i < productConsumo.size; i++) {
            const product = data.products.find((product) => product.code === Array.from(productConsumo.keys())[i])
            if (product) {
                const productConsumption = productConsumo.get(product.code)
                if (productConsumption) {
                    productConsumo.set(product.code, productConsumption + (productConsumo.get(product.code) ?? 0))
                }
                if((productConsumo.get(product.code) ?? 0) > product.stock-product.commited) {
                    if(product.supplies && product.supplies.length > 0){
                        product.supplies.forEach(supply=>{
                            productConsumo.set(supply.product_code, ((productConsumo.get(supply.product_code) ?? 0) + (supply.quantity * (productConsumo.get(product.code) ?? 0))))
                        })
                    }
                    else{
                        let validAmount = false;
                        product.imports.filter(impor=>new Date(String(impor.arrival_date)).getTime() > new Date().getTime()).forEach(impor=>{
                            console.log("fecha",impor.arrival_date);
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
        }
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