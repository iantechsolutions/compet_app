"use client";
import { useWindowSize } from "@uidotdev/usehooks";
import dayjs from "dayjs";
import { ChevronDown, ChevronUp, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { ComboboxDemo } from "~/components/combobox";
// import { List } from "~/components/list";
import type { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { excludeProducts } from "~/server/api/constants";
import { api } from "~/trpc/react";
import type { ProductWithDependencies } from "~/server/api/routers/consult";
import type { RouterOutputs } from "~/trpc/shared";
import { useMRPData } from "~/components/mrp-data-provider";
import type { CrmBudgetProduct } from "~/lib/types";
import { ConsultCutsDialog } from "./cuts-dialog";
const tableCellClassName = "flex items-center justify-center h-10 px-2 bg-white";

export default function ConsultsPage(props: { user?: NavUserData }) {
  const { mutateAsync: checkAvailability, isLoading } = api.consults.isConstructionPossible.useMutation();
  const { mutateAsync: notifyEmail, isLoading: isLoadingEmail } = api.consults.mailNotificacion.useMutation();

  // const { data, isLoading: isLoadingProducts } = api.db.getProducts.useQuery();
  // const { data: budgetProductByBudgetId, isLoading: isLoadingBudgets } = api.db.getBudgetProductsByBudgetId.useQuery();
  const { products: data, budget_products } = useMRPData();
  const budgetProductByBudgetId = new Map<number, CrmBudgetProduct[]>();
  for (const budgetProduct of budget_products) {
    const budgetProducts = budgetProductByBudgetId.get(budgetProduct.budget_id) ?? [];
    budgetProducts.push(budgetProduct);
    budgetProductByBudgetId.set(budgetProduct.budget_id, budgetProducts);
  }

  const [products, setProducts] = useState<RouterOutputs['db']['getProducts']>([]);
  const [budgetSelected, setBudgetSelected] = useState<null | string>(null);
  const [availabilityResult, setAvailabilityResult] = useState<{
    isPossible: boolean;
    buildDate?: number | null;
    productData: Map<string, { productDescription: string, stock: string, consumed: string, arrivalDate: Date | null }>;
  } | null>(null);

  const [finalList, setFinalList] = useState<ProductWithDependencies[]>([]);

  useEffect(() => {
    if (data) {
      // const months = data.months;

      const prod = data.filter(
        (product) => !excludeProducts.some((excludedProduct) => product.code.toLowerCase().startsWith(excludedProduct.toLowerCase())),
      );

      setProducts(
        prod,
        // .filter((product) => {
        //   if (product.stock !== 0) return true;

        //   for (const m of months) {
        //     const stock = product.stock_at.get(m);
        //     if (stock !== 0) return true;
        //   }

        //   return false;
        // })
      );
    }
  }, [data]);

  const size = useWindowSize();
  const [productList, setProductList] = useState<{ productCode: string; quantity: number }[] | null>([{ productCode: "", quantity: 0 }]);

  console.log(budgetProductByBudgetId);

  async function handleImportEmail() {
    // if (availabilityResult?.arrivalDatesNull) {
    //   const res = await notifyEmail({
    //     listado: availabilityResult.arrivalDatesNull,
    //   });
    // }
    if (finalList) {
      const res = await notifyEmail({
        listado: finalList.filter(x => !x.arrivalData && x.stock < x.consumed && !x.dependencies).map((product) => product.productCode),
      });
    }
  }

  async function handleAvailabilityCheck() {
    if (productList) {
      const res = await checkAvailability({
        listado: productList,
      });
      // const array: { productCode: string; productDescription: string; stock: string; consumed: string; arrivalDate: Date | null; }[] = []

      setFinalList(res);
    }
  }

  function handleProductCodeChange(value: string, index: number) {
    if (!productList) return;
    const newProductList = [...productList];
    if (!newProductList[index]) newProductList[index] = { productCode: "", quantity: 0 };
    newProductList[index].productCode = value;
    setProductList(newProductList);
  }

  function handleProductQuantityChange(value: number, index: number) {
    if (value < 0) return;
    if (!productList) return;
    const newProductList = [...productList];
    if (!newProductList[index]) newProductList[index] = { productCode: "", quantity: 0 };
    newProductList[index].quantity = value;
    setProductList(newProductList);
  }

  function insertProductAfterIndex(index: number) {
    if (!productList) return;
    const newProductList = [...productList];
    newProductList.splice(index + 1, 0, { productCode: "", quantity: 0 });
    setProductList(newProductList);
  }
  const headerCellClassName = "flex items-center justify-center font-semibold bg-stone-100 h-10 px-2";

  return (
    <AppLayout
      title={
        <div>
          <h1>{"Consulta de producción"}</h1>
        </div>
      }
      user={props?.user}
      sidenav={<AppSidenav />}
    >
      <div className="p-8">

        {/* TODO ponerlo prolijo */}
        <div className="w-full justify-between flex flex-row">
          <h1 className="mb-6 text-3xl font-bold">Consulta de Producción</h1>
          <div className="flex flex-row">
            <div className="pr-4">
              <ComboboxDemo
                title="Código de presup."
                placeholder="Código de presup."
                value={budgetSelected ?? ""}
                onSelectionChange={(value) => {
                  if (value) {
                    setBudgetSelected(value);
                  }
                }}
                options={Array.from(budgetProductByBudgetId.keys()).map((v) => ({
                  value: v.toString(),
                  label: v.toString(),
                }))}
              />
            </div>
            <Button onClick={() => {
              if (typeof budgetSelected === 'string' && budgetSelected.length > 0) {
                const budget = budgetProductByBudgetId?.get(Number(budgetSelected));
                if (budget === undefined) {
                  console.error(`budgetSelected ${budgetSelected} undefined`, budgetProductByBudgetId);
                } else {
                  const prodList = budget.map(v => {
                    return {
                      productCode: v.product_code,
                      quantity: v.quantity
                    }
                  });

                  const res = prodList.filter(v => {
                    return prodList.find(k => k.productCode === v.productCode) === v;
                  })

                  setProductList(res);
                }
              }
            }} disabled={budgetProductByBudgetId?.get(Number(budgetSelected)) === undefined}>Importar presupuesto</Button>
          </div>
        </div>

        {/* Product List Styled as a Bill */}
        <div className="grid grid-cols-1 gap-4">
          <table className="w-full border-collapse border border-gray-300 text-left">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">Código de Producto</th>
                <th className="border border-gray-300 px-4 py-2">Cantidad</th>
                <th className="border border-gray-300 px-4 py-2"></th>
                <th className="border border-gray-300 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {productList?.map((product, index) => (
                <tr key={index}>
                  {/* Product Code Combobox */}
                  <td className="border border-gray-300 px-4 py-2">
                    <ComboboxDemo
                      title="Código de producto"
                      placeholder="Seleccione un producto"
                      value={productList[index]?.productCode ?? ""}
                      onSelectionChange={(value) => {
                        if (value) {
                          handleProductCodeChange(value, index);
                        }
                      }}
                      options={products.map((product) => ({
                        value: product.code,
                        label: product.code,
                      }))}
                    />
                  </td>

                  {/* Quantity Input */}
                  <td className="border border-gray-300 px-4 py-2">
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      className="w-full"
                      value={productList[index]?.quantity}
                      onChange={(e) => handleProductQuantityChange(Number(e.target.value), index)}
                      placeholder="0"
                      required
                    />
                  </td>

                  {/* Add Button */}
                  <td className="border border-gray-300 px-4 py-2">
                    <Button disabled={isLoading} className="w-full" onClick={() => insertProductAfterIndex(index)}>
                      Agregar
                    </Button>
                  </td>

                  {/* Delete Button */}
                  <td className="border border-gray-300 px-4 py-2">
                    <Button
                      disabled={productList.length === 1 || isLoading}
                      className="w-full"
                      onClick={() => {
                        const newList = [...productList];
                        newList.splice(index, 1);
                        setProductList(newList);
                      }}
                      variant="destructive"
                    >
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Check Availability Button */}
        <div className="mt-6">
          <Button className="w-full py-3 text-lg" onClick={async () => handleAvailabilityCheck()} disabled={isLoading}>
            <div className="flex flex-row">
              {isLoading && <Loader2Icon className="mr-2 w-full animate-spin" />}
              Consultar Disponibilidad
            </div>
          </Button>
        </div>

        {/* Display Availability Results */}
        {/* {availabilityResult && !isLoading && (
          <div className="mt-6 rounded-md bg-white p-4 shadow-md">
            <h2 className="mb-4 text-2xl font-bold">Resultado de Disponibilidad</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className={`inline-block text-lg font-semibold ${availabilityResult.isPossible ? "text-green-600" : "text-red-600"}`}>
                  {availabilityResult.isPossible
                    ? "Posible"
                    : typeof availabilityResult.buildDate === "number"
                      ? "No es posible ahora"
                      : "No figura ingreso de stock suficiente"}
                </span>
              </div>
              {!availabilityResult.isPossible && availabilityResult.buildDate && (
                <div className="flex items-center">
                  <span className="text-lg text-gray-500">Fecha de Refill de stock: </span>
                  <span className="ml-2 text-lg font-medium text-gray-700">
                    {availabilityResult.buildDate ? dayjs(new Date(availabilityResult.buildDate + 172800000)).format("MM/YYYY") : ""}
                  </span>
                </div>
              )}
            </div>
            {availabilityResult.arrivalDatesSorted.map((date) => (
              <div key={`p-arrival-${date[0]}`}>
                <span className={`inline-block text-lg`}>
                  {`\nEl producto ${date[0]} ingresará en la fecha ${dayjs(date[1]).format("DD/MM/YYYY")}`}
                </span>
              </div>
            ))}
            {availabilityResult.arrivalDatesNull.map((date) => (
              <div key={`p-arrivaln-${date}`}>
                <span className={`inline-block text-lg text-red-600`}>
                  {`\nEl producto ${date} no tiene stock suficiente ni orden de compra planificada`}
                </span>
              </div>
            ))}
            {availabilityResult.arrivalDatesNull.length > 0 ? (
              <Button className="w-full py-3 text-lg" onClick={async () => handleImportEmail()} disabled={isLoading}>
                <div className="flex flex-row">
                  {isLoadingEmail && <Loader2Icon className="mr-2 w-full animate-spin" />}
                  Enviar email para notificar falta de orden de compra
                </div>
              </Button>
            ) : (
              <></>
            )}
          </div>
        )} */}



        {finalList && finalList.length > 0 && !isLoading && (
          <>
            <ListRowContainer style={{ overflowX: "hidden" }} className="z-10 shadow-md grid grid-cols-6">
              <div className={cn(headerCellClassName, "flex md:left-0")}>
                <p>Producto</p>
              </div>
              <div className={cn(headerCellClassName, "flex md:left-0")}>
                <p>Máximo posible</p>
              </div>
              <div className={cn(headerCellClassName, "flex md:left-0")}>
                <p>Stock Actual</p>
              </div>
              <div className={cn(headerCellClassName, "flex md:left-0")}>
                <p>Stock Necesario</p>
              </div>
              <div className={cn(headerCellClassName, "flex md:left-0")}>
                <p>Fecha de entrada</p>
              </div>
              <div className={cn(headerCellClassName, "flex md:left-0 justify-center")}>
                <p></p>
              </div>
            </ListRowContainer>
            {finalList.map((product, index) => (
              <ProductRow key={index} product={product} />
            ))}
          </>
        )}
      </div>
    </AppLayout>
  );
}
export function ListRowContainer({
  children,
  style,
  id,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
  columnLength?: number;
}) {
  return (
    <div
      className={className}
      id={id}
      style={{
        ...style,
        display: "grid",
        // gridTemplateColumns: `371px repeat(${columnLength ?? 1}, minmax(130px, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}


const ProductRow: React.FC<{ product: ProductWithDependencies; depth?: number }> = ({ product, depth = 0 }) => {
  const [showDependencies, setShowDependencies] = useState(false);

  // Toggle visibility of dependencies
  const toggleDependencies = () => setShowDependencies(!showDependencies);

  let arrivalDate: string;
  let arrivalDataId: string | null = null;
  if (product.arrivalData) {
    arrivalDate = dayjs(product.arrivalData.date.toString()).format("DD-MM-YYYY");
    arrivalDataId = product.arrivalData.importId;
  } else {
    if (product.dependencies) {
      if (product.cuts !== null && product.state === 'import') {
        const dep = product.dependencies[0]!;
        const arrDate = dep.arrivalData!;
        arrivalDate = dayjs(arrDate.date.toString()).format("DD-MM-YYYY");
        arrivalDataId = arrDate.importId;
        product = dep;
      } else {
        arrivalDate = "-";
      }
    } else {
      if (product.cuts !== null) {
        if (product.cuts.length > 0) {
          // ver product.cuts
          arrivalDate = "Hay suficientes recortes";
        } else {
          arrivalDate = "No hay suficientes recortes";
        }
      } else {
        if (product.stock >= product.consumed) {
          arrivalDate = "Hay suficiente stock";
        } else {
          arrivalDate = "No hay pedido registrado";
        }
      }
    }
  }

  let color;
  if (product.state === 'sinEntrada') {
    color = 'bg-[#f9c3c3]';
  } else if (product.state === 'import') {
    color = 'bg-[#fbfcb8]';
  } else if (product.state === 'preparable') {
    color = 'bg-[#BEF0BB]';
  } else {
    console.error('product.state', product.state);
    color = 'bg-gray-500';
  }

  let maxConsumible = "";
  if (product.maxConsumible !== undefined) {
    if (typeof product.maxConsumible === 'number') {
      if (product.maxConsumible < 0) {
        maxConsumible = "inf";
      } else {
        maxConsumible = product.maxConsumible.toString();
      }
    } else {
      maxConsumible = product.maxConsumible.consumed.toString();
    }
  }

  return (
    <div className="bg-gray-500">
      <ListRowContainer className={`${color} z-10 shadow-md grid grid-cols-6 ml-${depth * 4}`}>
        <div className={cn(tableCellClassName, `${color} min-h-16 flex md:left-0 flex-col`)}>
          <p>{product.productCode}</p>
          <div className="md:text-[10px] sm:text-[9px] font-semibold text-center">
            <p>{product.description}</p>
          </div>
          <div className="md:text-[10px] sm:text-[9px] font-semibold text-center">
            <p>{product.additional_description}</p>
          </div>
        </div>
        <div className={cn(tableCellClassName, `${color} h-full flex md:left-0`)}>
          <p>{maxConsumible}</p>
        </div>
        <div className={cn(tableCellClassName, `${color} h-full flex md:left-0`)}>
          <p>{product.realStock.toFixed(1)}</p>
        </div>
        <div className={cn(tableCellClassName, `${color} h-full flex md:left-0`)}>
          <p>{Math.round(product.consumed)}</p>
        </div>
        <div className={cn(tableCellClassName, `${color} h-full flex md:left-0 flex-col`)}>
          <p>{arrivalDate}</p>
          {arrivalDataId !== null ? <div className="whitespace-nowrap text-xs font-semibold">
            <p>{arrivalDataId.slice(-4)}</p>
          </div> : <></>}
        </div>
        <div className={cn(tableCellClassName, `${color} h-full flex md:left-0 justify-center`)}>
          {product.cuts !== null && (
            <ConsultCutsDialog product={product} cuts={product.cuts}>
              <Button variant="link" >?</Button>
            </ConsultCutsDialog>
          )}

          {/* <Popover>
              <PopoverTrigger asChild>
                <Button variant="link" >?</Button>
              </PopoverTrigger>
              <PopoverContent className="rounded-xl">
                {product.cuts.map((cut) => <>
                  <div key={cut.cut.id} className="flex flex-col gap-1 p-2 rounded-xl border-2 mb-2">
                    <p>Id: {cut.cut.id}</p>
                    <p>Location: {cut.cut.location}</p>
                    <p>Cantidad: {cut.cut.amount}</p>
                    <p>Medida: {cut.cut.measure}</p>

                  </div>
                </>)}
              </PopoverContent>
            </Popover> */ }

          {product.dependencies && product.cuts === null && product.dependencies.length > 0 && (
            <Button variant="outline" onClick={toggleDependencies} className="bg-white px-2 my-2">
              {showDependencies ?
                <ChevronUp />
                :
                <ChevronDown />
              }
            </Button>
          )}
        </div>

      </ListRowContainer>

      {showDependencies && product.dependencies?.map((dependency) => (
        <div key={`div-${dependency.productCode}`}>
          <ProductRow key={dependency.productCode} product={dependency} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
};

