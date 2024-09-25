"use client";
import dayjs from "dayjs";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { ComboboxDemo } from "~/components/combobox";
import { useMRPData } from "~/components/mrp-data-provider";
import type { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { excludeProducts } from "~/server/api/constants";
import { api } from "~/trpc/react";

export default function ConsultsPage(props: { user?: NavUserData }) {
  const { mutateAsync: checkAvailability, isLoading } = api.consults.isConstructionPossible.useMutation();
  const { mutateAsync: notifyEmail, isLoading: isLoadingEmail } = api.consults.mailNotificacion.useMutation();

  interface Product {
    commited: number;
    stock_at: Map<string, number>;
    imported_quantity_by_month: Map<string, number>;
    ordered_quantity_by_month: Map<string, number>;
    stock_variation_by_month: Map<string, number>;
    additional_description: string;
    code: string;
    description: string;
    stock: number;
    supplies: { product_code: string; quantity: number }[];
    imports: { arrival_date: Date; ordered_quantity: number }[];
  }

  const data = useMRPData();
  const [products, setProducts] = useState<Product[]>([]);
  const [availabilityResult, setAvailabilityResult] = useState<{
    isPossible: boolean;
    buildDate?: number | null;
    arrivalDatesSorted: [string, Date][];
    arrivalDatesNull: string[];
  } | null>(null);

  useEffect(() => {
    if (data) {
      // const months = data.months;
      console.log("pre", data.products.length);
      const prod = data.products.filter(
        (product) => !excludeProducts.some((excludedProduct) => product.code.toLowerCase().startsWith(excludedProduct.toLowerCase())),
      );
      console.log("post", prod.length);
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

  const [productList, setProductList] = useState<{ productCode: string; quantity: number }[] | null>([{ productCode: "", quantity: 0 }]);

  async function handleImportEmail() {
    if (availabilityResult?.arrivalDatesNull) {
      const res = await notifyEmail({
        listado: availabilityResult.arrivalDatesNull,
      });
    }
  }

  async function handleAvailabilityCheck() {
    if (productList) {
      const res = await checkAvailability({
        listado: productList,
      });

      // Response is a single object { isPossible: boolean, buildDate?: Date }
      console.log("res", res);

      function notNull<T, C>(value: [C, T | null]): value is [C, T] {
        return value[1] !== null;
      }

      const arrivalDatesSorted: [string, Date][] = [...res.arrivalDates.entries()].filter(notNull);
      arrivalDatesSorted.sort((a, b) => a[1].getTime() - b[1].getTime());

      function isNull<T, C>(value: [C, T | null]): value is [C, null] {
        return value[1] === null;
      }

      const arrivalDatesNull: string[] = [...res.arrivalDates.entries()].filter(isNull).map((v) => v[0]);
      setAvailabilityResult({
        isPossible: res.isPossible,
        buildDate: res.buildDate ?? null,
        arrivalDatesSorted,
        arrivalDatesNull,
      });
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
        <h1 className="mb-6 text-3xl font-bold">Consulta de Producción</h1>

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
        {availabilityResult && !isLoading && (
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
        )}
      </div>
    </AppLayout>
  );
}
