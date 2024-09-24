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

// import { excludeProducts } from 'constants';

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
      const productConsumo: [string, number][] = [];
      const yaConsumidoLoop = new Map<string, number>();

      input.listado.forEach((product) => {
        productConsumo.push([product.productCode, product.quantity]);
      });

      let unDateable = false;
      const arrivalDates = new Map<string, Date>();

      let i = 0;
      while (i < productConsumo.length) {
        const pcKey = productConsumo[i]?.[0];
        const pcValue = productConsumo[i]?.[1] ?? 0;

        // no tiene sentido que esto llegue a cumplirse porque nunca sacamos elementos mientras iteramos
        // pero el linter se queja asi que lo pongo igualmente
        if (pcKey === undefined || pcValue === undefined) {
          throw "Unexpected productConsumo[i] key/value undefined";
        }

        const product = curatedProducts.find((product) => product.code === pcKey);
        if (product) {
          const expiredNotImportEvents = (eventsByProductCode.get(product.code) ?? []).filter(
            (event) => event.expired && event.type !== "import",
          );

          const commited = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);
          const consumedTotal = commited + (yaConsumidoLoop.get(pcKey) ?? 0);

          // falta
          if (pcValue > product.stock - consumedTotal) {
            if (product.supplies && product.supplies.length > 0) {
              // productConsumo.set(product.code, 0)
              product.supplies.forEach((supply) => {
                const productSupply = productConsumo.find((v) => supply.product_code === v[0])?.[1] ?? 0;
                productConsumo.push([
                  supply.supply_product_code,
                  productSupply + supply.quantity * pcValue
                  // - (product.stock - commited o consumedTotal)  //?????????????? revisar
                ]);
              });

              // no se consume porque no hay, solo se agregan los supplies los cuales van a consumirse en prox iter.
              // yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
            } else {
              let validAmount = false;
              // AGREGAR SORT?????, PARA QUE EMPIEZE DESDE IMPORT MAS CERCANO
              // product.imports.sort((a, b) => a.arrival_date.getTime() - b.arrival_date.getTime());
              product.imports
                .filter((impor) => new Date(String(impor.arrival_date)).getTime() > new Date().getTime())
                .forEach((impor) => {
                  if (pcValue < product.stock - consumedTotal + impor.ordered_quantity && !validAmount) {
                    arrivalDates.set(product.code, new Date(String(impor.arrival_date)));
                    validAmount = true;
                  }
                });

              if (!validAmount) {
                unDateable = true;
              } else {
                // se consume incluyendo el import
                yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
              }
            }
          } else {
            // alcanza y se consume
            yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
          }
        }
        i++;
      }

      const objRes: {
        isPossible: boolean;
        buildDate: null | number;
        arrivalDates: Map<string, Date>;
      } = {
        isPossible: false,
        buildDate: null, // debería llamarse arrivalDate pero por cuestiones de frontend por las dudas no lo toco
        arrivalDates,
      };

      if (unDateable) {
        // intacto
      } else if (arrivalDates.size > 0) {
        objRes.buildDate = Math.max(...[...arrivalDates.values()].map((date) => date.getTime()));
      } else {
        objRes.isPossible = true;
      }

      return objRes;
    }),
});
