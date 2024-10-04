import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { queryBaseMRPData } from "~/serverfunctions";
import { excludeProducts } from "../constants";
import { type ForecastProfile, listAllEventsWithSupplyEvents, listProductsEvents, mapData, type ProductEvent } from "~/mrp_data/transform_mrp_data";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { getUserSetting } from "~/lib/settings";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { forecastProfiles } from "~/server/db/schema";
import { eq, type InferSelectModel } from "drizzle-orm";
import { nullProfile } from "~/lib/nullForecastProfile";
import { Resend } from "resend";
import { NotificacionMailTemplate } from "~/components/email-notification-template";
import { env } from "process";

// import { excludeProducts } from 'constants';

export interface ProductWithDependenciesCut {
  cut: InferSelectModel<typeof schema.cuts>;
  amount: number;
}

export interface ProductWithDependencies {
  productCode: string;
  stock: number;
  dependencies: ProductWithDependencies[] | null;
  arrivalDate: Date | null;
  consumed: number;
  cuts: ProductWithDependenciesCut[] | null;
}

async function prodUsesCuts(prodCode: string): Promise<boolean> {
  const cuts = await db.query.cuts.findMany({
    where: eq(schema.cuts.prodId, prodCode)
  });

  return true;
  // return cuts.length > 0;
}

async function getConsumoForProductList(
  listado: ProductWithDependencies[], 
  yaConsumidoLoop: Map<string, number>, 
  yaConsumidoCuts: Map<number, number>, 
  curatedProducts: { code: string; stock: number; supplies: { supply_product_code: string; quantity: number }[]; imports: { arrival_date: Date; ordered_quantity: number }[] }[], 
  eventsByProductCode: Map<string, ProductEvent[]>,
  // ya están ordenados de menor a mayor measure
  productCuts: Map<string, InferSelectModel<typeof schema.cuts>[]>,
) {
  const listadoCopy = listado;
  // const productConsumo: [string, number][] = [];
  // const yaConsumidoLoop = new Map<string, number>();

  const promises = listado.map(async (prod,index) => {
    
    const pcKey = prod.productCode;
    const pcValue = prod.consumed;
    const product = curatedProducts.find((product) => product.code === prod.productCode);

    if (product !== undefined) {
      const usesCuts = await prodUsesCuts(product.code);
      const expiredNotImportEvents = (eventsByProductCode.get(product.code) ?? []).filter(
        (event) => event.expired && event.type !== "import",
      );

      const commited = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);
      const consumedTotal = commited + (yaConsumidoLoop.get(pcKey) ?? 0);
      const inventory = Math.max(0, product.stock - consumedTotal);

      if (usesCuts) {
        const selectedProdCuts = productCuts.get(product.code) ?? [];
        const cutsUsed: ProductWithDependenciesCut[] = [];
        let falta = false;
        let pcValueFaltante = pcValue;

        // si no hay recortes me fijo directo en el supply
        // no pasa nada que el while se ejecute una vez, recorrido va a ser 0
        if (selectedProdCuts.length < 1) {
          falta = true;
        }

        // esta complejidad cuadrática no es muy grave
        // porque en cada iteración recorre menos elementos del for (o podría encontrar todo de golpe)
        do {
          pcValueFaltante = pcValue - cutsUsed.map(v => v.cut.measure * v.amount).reduce((x, y) => x + y, 0);
          let recorrido = 0;

          // esto prioriza los más cercanos a 0 (se ordena en el router)
          for (const cut of selectedProdCuts) {
            const maxConsumibleCut = cut.amount - (yaConsumidoCuts.get(cut.id) ?? 0);
            if (pcValueFaltante % cut.measure === 0 && maxConsumibleCut > 0) {
              const consumidoCutAmount = Math.max(pcValueFaltante / cut.measure, maxConsumibleCut);
              cutsUsed.push({
                cut,
                amount: consumidoCutAmount
              });

              yaConsumidoCuts.set(cut.id, (yaConsumidoCuts.get(cut.id) ?? 0) + consumidoCutAmount);
              recorrido += 1;
            }

            pcValueFaltante = pcValue - cutsUsed.map(v => v.cut.measure * v.amount).reduce((x, y) => x + y, 0);

            if (pcValueFaltante === 0) {
              break;
            }
          }

          // si no hubo ningun recorte disponible para armar el producto, falta
          if (recorrido === 0) {
            // falta = true;
            break;
          }
        } while (!falta || pcValueFaltante > 0);

        // no se encontraron suficientes recortes, busco supply
        if (pcValueFaltante > 0) {
          // hay supplies
          if (product.supplies && product.supplies.length > 0) {
            const cons = await getConsumoForProductList(
              product.supplies.map((supply) => ({
                arrivalDate: null,
                consumed: supply.quantity * (pcValue - (Math.max(0, product.stock - consumedTotal))),
                dependencies: null,
                productCode: supply.supply_product_code,
                stock: 0,
                cuts: null
              })),
              yaConsumidoLoop,
              yaConsumidoCuts,
              curatedProducts,
              eventsByProductCode,
              productCuts,
            );

            listadoCopy[index] = {
              arrivalDate: null,
              consumed: pcValue,
              dependencies: cons,
              productCode: product.code,
              stock: inventory,
              cuts: cutsUsed
            }

          // no hay supplies, se fija si va a importar
          } else {
            let validAmount = false;
            product.imports
              .filter((impor) => new Date(String(impor.arrival_date)).getTime() > new Date().getTime())
              .forEach((impor) => {
                if (pcValue < product.stock - consumedTotal + impor.ordered_quantity && !validAmount) {

                  listadoCopy[index] = {
                    arrivalDate: new Date(String(impor.arrival_date)),
                    consumed: pcValue,
                    dependencies: null,
                    productCode: product.code,
                    stock: inventory,
                    cuts: cutsUsed
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
              listadoCopy[index] = {
                arrivalDate: null,
                consumed: pcValue,
                dependencies: null,
                productCode: product.code,
                stock: inventory,
                cuts: cutsUsed
              }
            }
          }
        } else {
          yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
          listadoCopy[index] = {
            arrivalDate: null,
            consumed: pcValue,
            dependencies: null,
            productCode: product.code,
            stock: inventory,
            cuts: cutsUsed,
          }
        }
      } else { // sin recortes
        // falta
        if (pcValue > product.stock - consumedTotal) {
          // hay supplies
          if (product.supplies && product.supplies.length > 0) {
            const cons = await getConsumoForProductList(
              product.supplies.map((supply) => ({
                arrivalDate: null,
                consumed: supply.quantity * (pcValue - (Math.max(0, product.stock - consumedTotal))),
                dependencies: null,
                productCode: supply.supply_product_code,
                stock: 0,
                cuts: null
              })),
              yaConsumidoLoop,
              yaConsumidoCuts,
              curatedProducts,
              eventsByProductCode,
              productCuts,
            );

            console.log("entra aca");
            
            listadoCopy[index] = {
              arrivalDate: null,
              consumed: pcValue,
              dependencies: cons,
              productCode: product.code,
              stock: inventory,
              cuts: null
            }
            console.log(listadoCopy);

          // no hay supplies, se fija si va a importar
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
                    cuts: null
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
                cuts: null
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
            cuts: null,
          }
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
        cuts: [],
      }));

      const [data, session, allCuts] = await Promise.all([
        await queryBaseMRPData(),
        await getServerAuthSession(),
        await db.query.cuts.findMany(),
      ]);

      // ordeno por mts o ctd
      allCuts.sort((a, b) => a.measure - b.measure);
      const productCuts = new Map<string, InferSelectModel<typeof schema.cuts>[]>();
      for (const cut of allCuts) {
        if (productCuts.has(cut.prodId)) {
          productCuts.get(cut.prodId)?.push(cut);
        } else {
          productCuts.set(cut.prodId, [cut]);
        }
      }

      // Obs: productCuts tiene listas ordenadas de menor a mayor measure
      // porque allCuts base ya está ordenado

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
      const eventsByProductCode = listProductsEvents(evolvedData, events);
      const curatedProducts = data.products.filter(
        (product) => !excludeProducts.some((excludedProduct) => product.code.toLowerCase().startsWith(excludedProduct)),
      );

      const coso = await getConsumoForProductList(
        array,
        new Map<string, number>(),
        new Map<number, number>(),
        curatedProducts,
        eventsByProductCode,
        productCuts
      );

      console.log(coso);
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

      /* const { data: emailData, error } = */ await resend.emails.send({
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
