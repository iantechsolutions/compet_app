"use client";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { ComboboxDemo } from "~/components/combobox";
import { useMRPData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

export default function ConsultsPage(props: { user?: NavUserData }) {
  const { mutateAsync: checkAvailability, isLoading } = api.consults.isConstructionPossible.useMutation();

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
  const [availabilityResult, setAvailabilityResult] = useState<{ isPossible: boolean; buildDate?: number | null } | null>(null);

  useEffect(() => {
    if (data) {
      const months = data.months;
      setProducts(
        data.products
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

  const [productList, setProductList] = useState<{ productCode: string; quantity: number }[] | null>([
    { productCode: "", quantity: 0 },
  ]);

  async function handleAvailabilityCheck() {
    if (productList) {
      const res = await checkAvailability({
        listado: productList
      });

      // Response is a single object { isPossible: boolean, buildDate?: Date }
      setAvailabilityResult({
        isPossible: res.isPossible,
        buildDate: res.buildDate || null,
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
    if(value < 0) return;
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
        <h1 className="text-3xl font-bold mb-6">Consulta de Producción</h1>

        {/* Product List Styled as a Bill */}
        <div className="grid grid-cols-1 gap-4">
          <table className="w-full text-left border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">Código de Producto</th>
                <th className="border border-gray-300 px-4 py-2">Cantidad</th>
                <th className="border border-gray-300 px-4 py-2"></th>
                <th className="border border-gray-300 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {productList &&
                productList.map((product, index) => (
                  <tr key={index}>
                    {/* Product Code Combobox */}
                    <td className="border border-gray-300 px-4 py-2">
                      <ComboboxDemo
                        title="Código de producto"
                        placeholder="Seleccione un producto"
                        value={productList[index]?.productCode || ""}
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
                      <Button
                        disabled={isLoading}
                        className="w-full"
                        onClick={() => insertProductAfterIndex(index)}
                      >
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
              {isLoading && <Loader2Icon className='animate-spin mr-2 w-full' />}
              Consultar Disponibilidad
            </div>
          </Button>
        </div>

        {/* Display Availability Results */}
{availabilityResult && !isLoading && (
  <div className="mt-6 p-4 bg-white shadow-md rounded-md">
    <h2 className="text-2xl font-bold mb-4">Resultado de Disponibilidad</h2>
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <span className={`inline-block text-lg font-semibold ${availabilityResult.isPossible ? 'text-green-600' : 'text-red-600'}`}>
          {availabilityResult.isPossible ? "Posible" : availabilityResult.buildDate ? "No es posible ahora" : "No figura ingreso de stock suficiente"}
        </span>
      </div>
      {
        !availabilityResult.isPossible && availabilityResult.buildDate &&
      <div className="flex items-center">
        <span className="text-gray-500 text-lg">Fecha de Refill de stock: </span>
        <span className="ml-2 text-lg font-medium text-gray-700">
          {availabilityResult.buildDate ? new Date(availabilityResult.buildDate).toLocaleDateString() : ""}
        </span>
      </div>
      }
    </div>
  </div>
)}

      </div>
    </AppLayout>
  );
}
