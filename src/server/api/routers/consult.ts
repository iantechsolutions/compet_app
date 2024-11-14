import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { queryBaseMRPData } from "~/serverfunctions";
import { excludeProducts } from "../constants";
import { type ForecastProfile, type ProductEvent } from "~/mrp_data/transform_mrp_data";
import { getUserSetting } from "~/lib/settings";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import type * as schema from "~/server/db/schema";
import { forecastProfiles } from "~/server/db/schema";
import { eq, type InferSelectModel } from "drizzle-orm";
import { nullProfile } from "~/lib/nullForecastProfile";
import { Resend } from "resend";
import { NotificacionMailTemplate } from "~/components/email-notification-template";
import { env } from "process";
import { isSemiElaborate } from "~/lib/utils";
import { cachedAsyncFetch } from "~/lib/cache";
import { getMonolitoByForecastId } from "~/lib/monolito";
import { defaultCacheTtl } from "~/scripts/lib/database";

// import { excludeProducts } from 'constants';

export interface ProductWithDependenciesCut {
  cut: InferSelectModel<typeof schema.cuts>;
  amount: number;
}

export interface ProductWithDependencies {
  productCode: string;
  description: string;
  additional_description: string;
  stock: number;
  dependencies: ProductWithDependencies[] | null;
  arrivalData: {
    date: Date;
    importId: string;
  } | null;
  consumed: number;
  maxConsumible?: number | ProductWithDependencies;
  cuts: ProductWithDependenciesCut[] | null;
  state: "preparable" | "import" | "sinEntrada" | null;
}

function weakestState(entries: ProductWithDependencies[]): "import" | "preparable" | "sinEntrada" {
  let state: "import" | "preparable" | "sinEntrada" = "preparable";
  for (const entry of entries) {
    const eState = getState(entry);
    if (state === "preparable") {
      if (eState === "sinEntrada") {
        state = "sinEntrada";
        break;
      } else if (eState === "import") {
        state = "import";
      }
    } else if (state === "import") {
      if (eState === "sinEntrada") {
        state = "sinEntrada";
        break;
      }
    } else {
      break;
    }
  }

  return state;
}

function getState(entry: ProductWithDependencies): "import" | "preparable" | "sinEntrada" {
  if (entry.dependencies) {
    return weakestState(entry.dependencies);
  } else if (entry.arrivalData) {
    return "import";
  } else {
    if (entry.cuts !== null) {
      if (entry.cuts.length > 0) {
        return "preparable";
      } else {
        return "sinEntrada";
      }
    } else {
      if (entry.stock >= entry.consumed) {
        return "preparable";
      } else {
        return "sinEntrada";
      }
    }
  }
}

function setState(entry: ProductWithDependencies) {
  entry.state = getState(entry);
  if (entry.dependencies) {
    for (const dep of entry.dependencies) {
      setState(dep);
    }
  }
}

function initializeProductWDeps(prod: {
  quantity: number,
  productCode: string
}): ProductWithDependencies {
  return {
    arrivalData: null,
    consumed: prod.quantity,
    dependencies: null,
    productCode: prod.productCode,
    description: "",
    additional_description: "",
    stock: 0,
    cuts: [],
    state: null,
  };
}

function mapConsumoWithMax(element: ProductWithDependencies) {
  if (!element.dependencies) {
    return;
  }

  if (typeof element.maxConsumible === 'number') {
    for (const dep of (element.dependencies ?? [])) {
      dep.maxConsumible = element.maxConsumible;
      mapConsumoWithMax(dep);
    }

    return;
  } else if (typeof element.maxConsumible !== 'object') {
    console.error('mapConsumoWithMax llamado sin maxConsumible');
    return;
  }

  const maxConDeps = element.maxConsumible.dependencies ?? [];
  if (element.dependencies.length !== maxConDeps.length) {
    console.error('mapConsumoWithMax dependiencias.length difiere');
    console.error('mapConsumoWithMax deps1', element.dependencies);
    console.error('mapConsumoWithMax deps2', maxConDeps);
    return;
  }

  for (let i = 0; i < element.dependencies.length; i++) {
    if (element.dependencies[i]!.productCode !== maxConDeps[i]!.productCode) {
      console.error('mapConsumoWithMax dependencia difiere en elemento', element.dependencies[i]!.productCode);
      console.error('mapConsumoWithMax deps1', element.dependencies);
      console.error('mapConsumoWithMax deps2', maxConDeps);
      return;
    }

    element.dependencies[i]!.maxConsumible = maxConDeps[i]!;

    for (const dep of element.dependencies) {
      mapConsumoWithMax(dep);
    }
  }
}

function maxConsumoForProductList(
  resultadoBase: ReturnType<typeof getConsumoForProductList>,
  curatedProducts: Awaited<ReturnType<typeof queryBaseMRPData>>["products"],
  eventsByProductCode: Record<string, ProductEvent<number | Date>[]>,
  productCuts: Map<string, InferSelectModel<typeof schema.cuts>[]>,
  productsByCode: Awaited<ReturnType<typeof getMonolitoByForecastId>>["productsByCode"],
) {
  for (const prodRes of resultadoBase) {
    let isBestResult = false;
    let res = prodRes;
    let cantidad = prodRes.consumed;
    const incrementar = res.state === 'preparable';

    while (!isBestResult) {
      if (incrementar) {
        cantidad += 1;
      } else {
        cantidad -= 1;
      }

      if (cantidad < 1) {
        console.error(`maxConsumoForProductList dec < 1 ${prodRes.productCode}`);
        break;
      }

      const resTmpBase = getConsumoForProductList(
        [initializeProductWDeps({
          productCode: prodRes.productCode,
          quantity: cantidad,
        })],
        new Map(),
        new Map(),
        curatedProducts,
        eventsByProductCode,
        productCuts,
        productsByCode
      );

      for (const entry of resTmpBase) {
        setState(entry);
      }

      const resTmp = resTmpBase[0]!;

      if (incrementar) {
        if (resTmp.state !== 'preparable') {
          isBestResult = true;
        } else if (cantidad > 10000000) {
          console.error(`maxConsumoForProductList inc excedidos 10M para ${prodRes.productCode}`);
          break;
        } else {
          res = resTmp;
        }
      } else {
        if (resTmp.state === 'preparable') {
          res = resTmp;
          isBestResult = true;
        } else {
          res = resTmp;
        } /* else if (cantidad < 0) {
          console.error(`maxConsumoForProductList dec < 0 ${prodRes.productCode}`);
          break;
        } */
      }
    }

    if (isBestResult) {
      prodRes.maxConsumible = res;
    } else if (incrementar) {
      prodRes.maxConsumible = -1;
    } else {
      prodRes.maxConsumible = 0;
    }
  }

  for (const prodRes of resultadoBase) {
    mapConsumoWithMax(prodRes);
  }
}

function getConsumoForProductList(
  listado: ProductWithDependencies[],
  yaConsumidoLoop: Map<string, number>,
  yaConsumidoCuts: Map<number, number>,
  curatedProducts: Awaited<ReturnType<typeof queryBaseMRPData>>["products"],
  eventsByProductCode: Record<string, ProductEvent<number | Date>[]>,
  // ya están ordenados de menor a mayor measure
  productCuts: Map<string, InferSelectModel<typeof schema.cuts>[]>,
  productsByCode: Awaited<ReturnType<typeof getMonolitoByForecastId>>["productsByCode"],
) {
  let listadoCopy = listado;
  // const productConsumo: [string, number][] = [];
  // const yaConsumidoLoop = new Map<string, number>();

  listadoCopy = listado.filter((product) => !excludeProducts.some((excludedProduct) => product.productCode.startsWith(excludedProduct)));
  // console.log(listadoCopy.map((v) => v.productCode));

  listadoCopy.map((prod, index) => {
    const pcKey = prod.productCode;
    const pcValue = prod.consumed;
    const product = curatedProducts.find((product) => product.code === prod.productCode);

    if (product !== undefined) {
      const semielaborado = isSemiElaborate(product);
      const expiredNotImportEvents = (eventsByProductCode[product.code] ?? []).filter((event) => event.expired && event.type !== "import");

      const commited = expiredNotImportEvents.reduce((sum, event) => sum + event.quantity, 0);
      const consumedTotal = commited + (yaConsumidoLoop.get(pcKey) ?? 0);
      const inventory = Math.max(0, product.stock - commited);

      if (semielaborado !== null) {
        const { supply, long: pcMeasure } = semielaborado;
        const selectedProdCuts = productCuts.get(supply.supply_product_code) ?? [];
        selectedProdCuts.sort((a, b) => a.amount - b.amount);

        const cutsUsed: ProductWithDependenciesCut[] = [];

        let falta = false;
        let pcValueFaltante = pcValue;
        let pcValueConsumido = 0;

        // si no hay recortes me fijo directo en el supply
        // no pasa nada que el while se ejecute una vez, recorrido va a ser 0
        if (selectedProdCuts.length < 1) {
          falta = true;
        }

        let probarSinModulo = false;

        do {
          let recorrido = 0;

          // aca solo se fija con mod 0
          for (let i = 0; i < selectedProdCuts.length && pcValueFaltante > 0; i++) {
            const cut = selectedProdCuts[i]!;
            const maxConsumibleCut = cut.amount - (yaConsumidoCuts.get(cut.id) ?? 0);

            if (cut.measure >= pcMeasure && (cut.measure % pcMeasure === 0 || probarSinModulo) && maxConsumibleCut > 0) {
              const cutAmountNeeded = Math.ceil((pcValueFaltante * pcMeasure) / cut.measure);
              const cutAmountUsed = Math.min(cutAmountNeeded, maxConsumibleCut);
              cutsUsed.push({
                cut,
                amount: cutAmountUsed,
              });

              yaConsumidoCuts.set(cut.id, (yaConsumidoCuts.get(cut.id) ?? 0) + cutAmountUsed);
              /* console.log(
                `[${cutAmountNeeded}] ${pcMeasure} ${cutAmountUsed} ${maxConsumibleCut} ${pcValueFaltante} ${cut.measure} ${cut.amount}`,
              ); */
              const consumido = (cutAmountUsed * cut.measure) / pcMeasure;
              pcValueConsumido += consumido;
              pcValueFaltante -= consumido;
              // console.log(`${pcValueFaltante}`);
              recorrido += 1;
            }
          }

          if (recorrido === 0) {
            if (!probarSinModulo) {
              probarSinModulo = true;
            } else {
              break;
            }
          }
        } while (!falta || pcValueFaltante > 0);

        // no se encontraron suficientes recortes, busco supply
        if (pcValueFaltante > 0) {
          // hay supplies
          if (product.supplies && product.supplies.length > 0) {
            const cons = getConsumoForProductList(
              product.supplies.map((supply) => ({
                arrivalData: null,
                consumed: supply.quantity * (pcValue - pcValueConsumido),
                dependencies: null,
                productCode: supply.supply_product_code,
                description: "",
                additional_description: "",
                stock: 0,
                cuts: null,
                state: null,
              })),
              yaConsumidoLoop,
              yaConsumidoCuts,
              curatedProducts,
              eventsByProductCode,
              productCuts,
              productsByCode,
            );

            // console.log("recortes entra aca 3", product.code);
            listadoCopy[index] = {
              arrivalData: null,
              consumed: pcValue,
              dependencies: cons,
              productCode: product.code,
              description: product.description,
              additional_description: product.additional_description,
              stock: inventory,
              cuts: cutsUsed,
              state: null,
            };

            // no hay supplies, se fija si va a importar
          } else {
            let validAmount = false;
            const maxDate = new Date();
            maxDate.setDate(0);

            product.imports
              .filter((impor) => new Date(String(impor.arrival_date)).getTime() > maxDate.getTime())
              .forEach((impor) => {
                if (pcValueFaltante < impor.ordered_quantity && !validAmount) {
                  // console.log("recortes entra aca 2", product.code);
                  listadoCopy[index] = {
                    arrivalData: {
                      date: new Date(String(impor.arrival_date)),
                      importId: impor.import_id,
                    },
                    consumed: pcValue,
                    dependencies: null,
                    productCode: product.code,
                    description: product.description,
                    additional_description: product.additional_description,
                    stock: inventory,
                    cuts: cutsUsed,
                    state: null,
                  };

                  validAmount = true;
                  yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
                }
              });

            if (!validAmount) {
              // console.log("recortes entra aca 1", product.code);
              listadoCopy[index] = {
                arrivalData: null,
                consumed: pcValue,
                dependencies: null,
                productCode: product.code,
                description: product.description,
                additional_description: product.additional_description,
                stock: inventory,
                cuts: [],
                state: null,
              };
            }
          }
        } else {
          yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
          // console.log("recortes entra aca 0", product.code);
          listadoCopy[index] = {
            arrivalData: null,
            consumed: pcValue,
            dependencies: cutsUsed.map((v) => {
              return {
                productCode: v.cut.prodId,
                stock: v.cut.amount,
                dependencies: null,
                arrivalData: null,
                consumed: v.amount,
                description: productsByCode[v.cut.prodId]?.description ?? "",
                additional_description: productsByCode[v.cut.prodId]?.additional_description ?? "",
                cuts: null,
                state: null,
              };
            }),
            productCode: product.code,
            description: product.description,
            additional_description: product.additional_description,
            stock: inventory,
            cuts: cutsUsed,
            state: null,
          };
        }
      } else {
        // sin recortes
        // falta
        if (pcValue > product.stock - consumedTotal) {
          // hay supplies
          if (product.supplies && product.supplies.length > 0) {
            const cons = getConsumoForProductList(
              product.supplies.map((supply) => ({
                arrivalData: null,
                consumed: supply.quantity * (pcValue - Math.max(0, product.stock - consumedTotal)),
                dependencies: null,
                productCode: supply.supply_product_code,
                description: "",
                additional_description: '',
                stock: 0,
                cuts: null,
                state: null,
              })),
              yaConsumidoLoop,
              yaConsumidoCuts,
              curatedProducts,
              eventsByProductCode,
              productCuts,
              productsByCode,
            );

            // console.log("!recortes entra aca 3", product.code);
            listadoCopy[index] = {
              arrivalData: null,
              consumed: pcValue,
              dependencies: cons,
              productCode: product.code,
              description: product.description,
              additional_description: product.additional_description,
              stock: inventory,
              cuts: null,
              state: null,
            };
            // console.log(listadoCopy);

            // no hay supplies, se fija si va a importar
          } else {
            let validAmount = false;
            const maxDate = new Date();
            maxDate.setDate(0);

            product.imports
              .filter((impor) => new Date(String(impor.arrival_date)).getTime() > maxDate.getTime())
              .forEach((impor) => {
                if (pcValue < product.stock - consumedTotal + impor.ordered_quantity && !validAmount) {
                  console.log("!recortes entra aca 2", product.code);
                  listadoCopy[index] = {
                    arrivalData: {
                      date: new Date(String(impor.arrival_date)),
                      importId: impor.import_id,
                    },
                    consumed: pcValue,
                    dependencies: null,
                    productCode: product.code,
                    description: product.description,
                    additional_description: product.additional_description,
                    stock: inventory,
                    cuts: null,
                    state: null,
                  };

                  validAmount = true;
                  yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
                }
              });

            if (!validAmount) {
              console.log("!recortes entra aca 1", product.code);
              listadoCopy[index] = {
                arrivalData: null,
                consumed: pcValue,
                dependencies: null,
                productCode: product.code,
                description: product.description,
                additional_description: product.additional_description,
                stock: inventory,
                cuts: null,
                state: null,
              };
            }
          }
        } else {
          // alcanza y se consume
          yaConsumidoLoop.set(pcKey, (yaConsumidoLoop.get(pcKey) ?? 0) + pcValue);
          // console.log("!recortes entra aca 0", product.code);
          listadoCopy[index] = {
            arrivalData: null,
            consumed: pcValue,
            dependencies: null,
            productCode: product.code,
            description: product.description,
            additional_description: product.additional_description,
            stock: inventory,
            cuts: null,
            state: null,
          };
        }
      }
    } /* else {
      console.error("getConsumoForProductList product is undefined from curatedProducts", prod.productCode);
    } */
  });

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
      const array = input.listado.map((prod) => initializeProductWDeps(prod));
      const [session, allCuts] = await Promise.all([await getServerAuthSession(), await db.query.cuts.findMany()]);

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

      let data;
      if (forecastProfileId === null) {
        data = await cachedAsyncFetch(`monolito-fc-null`, defaultCacheTtl, async () => await getMonolitoByForecastId(null));
      } else {
        data = await cachedAsyncFetch(
          `monolito-fc-${forecastProfileId}`,
          defaultCacheTtl,
          async () => await getMonolitoByForecastId(forecastProfileId),
        );
      }

      const curatedProducts = data.products.filter(
        (product) => !excludeProducts.some((excludedProduct) => product.code.startsWith(excludedProduct)),
      );

      const res = getConsumoForProductList(
        array,
        new Map<string, number>(),
        new Map<number, number>(),
        curatedProducts,
        data.eventsByProductCode,
        productCuts,
        data.productsByCode,
      );

      for (const entry of res) {
        setState(entry);
      }

      // res se pasa por referencia
      maxConsumoForProductList(
        res,
        curatedProducts,
        data.eventsByProductCode,
        productCuts,
        data.productsByCode
      );

      console.dir(res, { depth: 50 });
      return res;
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
