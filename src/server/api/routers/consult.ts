import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { queryBaseMRPData } from "~/serverfunctions";
import { excludeProducts } from "../constants";
import { type ForecastProfile, listAllEventsWithSupplyEvents, listProductsEvents, mapData } from "~/mrp_data/transform_mrp_data";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { getUserSetting } from "~/lib/settings";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { forecastProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { nullProfile } from "~/lib/nullForecastProfile";
import { Resend } from "resend";
import { NotificacionMailTemplate } from "~/components/email-notification-template";
import { env } from "process";

// import { excludeProducts } from 'constants';

export interface ProductWithDependencies{
    productCode: string;
    stock: number;
    dependencies: ProductWithDependencies[] | null;
    arrivalDate: Date | null;
    consumed: number;
}
const data = await queryBaseMRPData();
  const session = await getServerAuthSession();
  const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", session?.user.id ?? "");

  let forecastProfile: ForecastProfile | null =
    forecastProfileId != null
      ? ((await db.query.forecastProfiles.findFirst({
          where: eq(forecastProfiles.id, forecastProfileId),
        })) ?? null)
      : null;

  if (!forecastProfile) {
    forecastProfile = nullProfile;
  }

  const forecastData = await queryForecastData(forecastProfile, data);
  const evolvedData = mapData(data, forecastData);
  const events = listAllEventsWithSupplyEvents(evolvedData);
  const curatedProducts = data.products.filter(
    (product) => !excludeProducts.some((excludedProduct) => product.code.toLowerCase().startsWith(excludedProduct)),
  );
  const eventsByProductCode = listProductsEvents(evolvedData, events);

async function getConsumoForProductList(listado: ProductWithDependencies[], yaConsumidoLoop: Map<string,number>){
  let listadoCopy = listado;
  // const productConsumo: [string, number][] = [];
  // const yaConsumidoLoop = new Map<string, number>();

  const promises = listado.map(async (prod,index) => {
    
    const pcKey = prod.productCode;
    const pcValue = prod.consumed;
    const product = curatedProducts.find((product) => product.code === prod.productCode);
        if (product) {
          const expiredNotImportEvents = (eventsByProductCode.get(product.code) ?? []).filter(
            (event) => event.expired && event.type !== "import",
          );
          const commited = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);
          const consumedTotal = commited + (yaConsumidoLoop.get(pcKey) ?? 0);
          const inventory = Math.max(0,product.stock - consumedTotal);
          // falta
          if (pcValue > product.stock - consumedTotal) {
            if (product.supplies && product.supplies.length > 0) {
              const cons = await getConsumoForProductList(product.supplies.map((supply) => ({
                arrivalDate: null,
                consumed: supply.quantity * (pcValue - (Math.max(0, product.stock - consumedTotal))),
                dependencies: null,
                productCode: supply.supply_product_code,
                stock: 0
              })), yaConsumidoLoop);
              console.log("entra aca");
              
              listadoCopy[index] = {
                arrivalDate: null,
                consumed: pcValue,
                dependencies: cons,
                productCode: product.code,
                stock: inventory,
              }
              console.log(listadoCopy);

            } else {
              let validAmount = false;
              product.imports
                .filter((impor) => new Date(String(impor.arrival_date)).getTime() > new Date().getTime())
                .forEach((impor) => {
                  if (pcValue < product.stock - consumedTotal + impor.ordered_quantity && !validAmount) {

                    console.log("entra aca 2");
                    listadoCopy[index] = {
                      arrivalDate: new Date(String(impor.arrival_date)),
                      consumed: pcValue,
                      dependencies: null,
                      productCode: product.code,
                      stock: inventory,
                    }

                    // productData.set(product.code, {
                    //   arrivalDate: new Date(String(impor.arrival_date)),
                    //   consumed: String(pcValue),
                    //   productDescription: product.description,
                    //   stock: String(product.stock - consumedTotal),
                    // });
                    // productData.set

                    validAmount = true;
                    yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
                  }
                });

              if (!validAmount) {
                console.log("entra aca 3");
                listadoCopy[index] = {
                  arrivalDate: null,
                  consumed: pcValue,
                  dependencies: null,
                  productCode: product.code,
                  stock: inventory,
                }

              }
            }
          } else {
            // alcanza y se consume
            yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
            console.log("entra aca 4");
            listadoCopy[index] = {
              arrivalDate: null,
              consumed: pcValue,
              dependencies: null,
              productCode: product.code,
              stock: inventory,
            }
          }
        }


  });
  await Promise.all(promises);
  return listadoCopy;
}


export const consultRouter = createTRPCRouter({
  isConstructionPossible: protectedProcedure
    .input(
      z.object({
        listado: z.array(
          z.object({
            productCode: z.string(),
            quantity: z.number(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      // const data = await queryBaseMRPData();
      // const session = await getServerAuthSession();
      // const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", session?.user.id ?? "");

      // let forecastProfile: ForecastProfile | null =
      //   forecastProfileId != null
      //     ? ((await db.query.forecastProfiles.findFirst({
      //         where: eq(forecastProfiles.id, forecastProfileId),
      //       })) ?? null)
      //     : null;

      // if (!forecastProfile) {
      //   forecastProfile = nullProfile;
      // }
      // const forecastData = await queryForecastData(forecastProfile, data);
      // const evolvedData = mapData(data, forecastData);
      // const events = listAllEventsWithSupplyEvents(evolvedData);
      // const curatedProducts = data.products.filter(
      //   (product) => !excludeProducts.some((excludedProduct) => product.code.toLowerCase().startsWith(excludedProduct)),
      // );
      // const eventsByProductCode = listProductsEvents(evolvedData, events);
      // const productConsumo: [string, number][] = [];
      // const yaConsumidoLoop = new Map<string, number>();

      // input.listado.forEach((product) => {
      //   productConsumo.push([product.productCode, product.quantity]);
      // });

      // let unDateable = false;
      // const productData = new Map<string, { productDescription:string, stock:string, consumed:string, arrivalDate:Date | null}>();
      // const productData2 :ProductWithDependencies[] = [];
      // let i = 0;
      // while (i < productConsumo.length) {
      //   const pcKey = productConsumo[i]?.[0];
      //   const pcValue = productConsumo[i]?.[1] ?? 0;

      //   // no tiene sentido que esto llegue a cumplirse porque nunca sacamos elementos mientras iteramos
      //   // pero el linter se queja asi que lo pongo igualmente
      //   if (pcKey === undefined || pcValue === undefined) {
      //     throw "Unexpected productConsumo[i] key/value undefined";
      //   }

      //   const product = curatedProducts.find((product) => product.code === pcKey);
      //   if (product) {
      //     const expiredNotImportEvents = (eventsByProductCode.get(product.code) ?? []).filter(
      //       (event) => event.expired && event.type !== "import",
      //     );

      //     const commited = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);
      //     const consumedTotal = commited + (yaConsumidoLoop.get(pcKey) ?? 0);

      //     // falta
      //     if (pcValue > product.stock - consumedTotal) {
      //       if (product.supplies && product.supplies.length > 0) {
      //         // productConsumo.set(product.code, 0)
      //         const inventory = Math.max(0,product.stock - consumedTotal);
      //         yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + inventory);
      //         product.supplies.forEach((supply) => {
      //           const productSupply = productConsumo.find((v) => supply.product_code === v[0])?.[1] ?? 0;
      //           productConsumo.push([
      //             supply.supply_product_code,
      //             productSupply + supply.quantity * (pcValue - (Math.max(0, product.stock - consumedTotal))),
      //             // - (product.stock - commited o consumedTotal)  //?????????????? revisar
      //           ]);
      //         });

      //         // no se consume porque no hay, solo se agregan los supplies los cuales van a consumirse en prox iter.
      //         // yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
      //       } else {
      //         let validAmount = false;
      //         // AGREGAR SORT?????, PARA QUE EMPIEZE DESDE IMPORT MAS CERCANO
      //         // product.imports.sort((a, b) => a.arrival_date.getTime() - b.arrival_date.getTime());
      //         product.imports
      //           .filter((impor) => new Date(String(impor.arrival_date)).getTime() > new Date().getTime())
      //           .forEach((impor) => {
      //             if (pcValue < product.stock - consumedTotal + impor.ordered_quantity && !validAmount) {
      //               productData.set(product.code, {
      //                 arrivalDate: new Date(String(impor.arrival_date)),
      //                 consumed: String(pcValue),
      //                 productDescription: product.description,
      //                 stock: String(product.stock - consumedTotal),
      //               });
      //               productData.set

      //               validAmount = true;
      //             }
      //           });

      //         if (!validAmount) {
      //           unDateable = true;
      //           productData.set(product.code, {
      //             arrivalDate: null,
      //             consumed: String(pcValue),
      //             productDescription: product.description,
      //             stock: String(product.stock - consumedTotal),
      //           });
      //         } else {
      //           // se consume incluyendo el import
      //           yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
      //         }
      //       }
      //     } else {
      //       // alcanza y se consume
      //       yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
      //     }
      //   }
      //   i++;
      // }

      // const objRes: {
      //   isPossible: boolean;
      //   buildDate: null | number;
      //   productData: Map<string, { productDescription:string, stock:string, consumed:string, arrivalDate:Date | null}>;
      // } = {
      //   isPossible: false,
      //   buildDate: null, // debería llamarse arrivalDate pero por cuestiones de frontend por las dudas no lo toco
      //   productData,
      // };

      // if (unDateable) {
      //   // intacto
      // } else if (productData.size > 0) {
      //   objRes.buildDate = Math.max(...[...productData.values()].map((data) => data.arrivalDate ? data.arrivalDate?.getTime() : 0));
      // } else {
      //   objRes.isPossible = true;
      // }


      const array = input.listado.map((prod) => ({
        arrivalDate: null,
        consumed: prod.quantity,
        dependencies: null,
        productCode: prod.productCode,
        stock: 0,
        }));
      const coso = getConsumoForProductList(
        array, new Map<string,number>()
      );
      return coso;
    }),
  mailNotificacion: protectedProcedure
    .input(
      z.object({
        listado: z.array(z.string().min(1).max(1023)),
      }),
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(env.RESEND_API_KEY);
      const mails = await getUserSetting<string[]>("mrp.mails", "");

      const { data: emailData, error } = await resend.emails.send({
        from: "desarrollo <desarrollo@iantech.com.ar>",
        to: mails ?? "",
        subject: "Productos faltantes",
        react: NotificacionMailTemplate({
          productList: input.listado.map((v) => {
            return { productCode: v };
          }),
        }),
      });
    }),
});
