"use client"
import { useParams } from "next/navigation";
import { CheckCheckIcon, CheckIcon, XSquareIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import ListSelectionDialog from "~/components/list-selection-dialog";
import { useMRPData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { MRPProduct } from "~/mrp_data/transform_mrp_data";
import { FixedSizeList as List } from 'react-window'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import { CrmBudget } from "~/lib/types";
import { formatStock } from "~/lib/utils";
import { SelectCRMClients } from "../../forecast/select-crm-clients";
import { string } from "zod";
import StackedAreaChart from "~/components/estadisticas/stackedAreaChart";
import SimpleLineChart from "~/components/estadisticas/simpleLineChart";
import SimpleBartChart from "~/components/estadisticas/simpleBartChart";
import { DatePicker } from "~/components/day-picker";
export default function StatisticsPage(props: { user?: NavUserData }) {
    const temporaryDate = new Date();
    temporaryDate.setFullYear(temporaryDate.getFullYear() - 1);
    const [fromDate, setFromDate] = useState<Date | undefined>(temporaryDate);
    const data = useMRPData();
    const params = useParams<{ code: string }>()
    const productCode = decodeURIComponent(params?.code ?? '')
    const product: MRPProduct | null = data.products.find((p) => p.code === productCode) ?? null
    const providers = data.providers;
    const products = data.products;
    const [providersSelected, setProvidersSelected] = useState<Set<string>>(new Set());
    
    
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
        const [unselectedClients, setSelected] = useState<Set<string>>(new Set())
    const { list: consumptionStats, totalConsumedAmount: totalTemp, totalMotiveConsumption: totalMotiveTemp } = getConsumptionStats(new Date('2023-09-04'), new Date(), Array.from(unselectedClients), Array.from(providersSelected), productCode);
    const tempSales = getSalesAndBudgets( fromDate ?? new Date('2023-09-04'), toDate ?? new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode);
    const tempSoldProportions = getSoldProportions( fromDate ?? new Date('2023-09-04'), toDate ?? new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode);
    const tempGeneral = getGeneralStatistics( fromDate ?? new Date('2023-09-04'), toDate ?? new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode);    
    const [consumption, setConsumption] = useState<{
        date: string;
        motive: string;
        amount: number;
    }[]>(consumptionStats);
    const [salesAndBudgets, setSalesAndBudgets] = useState<{ salesList: { date: string, totalSales: number }[], budgetsList: { date: string, totalBudgets: number }[] }>(tempSales);
    const [soldProportions, setSoldProportions] = useState<{ name: string | undefined, totalSales: number, amountOfSales: number }[]>(tempSoldProportions);
    const [generalStatistics, setGeneralStatistics] = useState<{ MaximumSales: number, MinimumSales: number, AverageSales: number, TotalSales: number, MedianSales: number | undefined }>(tempGeneral);
    const [totalConsumedAmount, setTotalConsumedAmount] = useState<number>(totalTemp);
    const [totalMotiveConsumption, setTotalMotiveConsumption] = useState<Map<string, number>>(totalMotiveTemp);
    const productsByProvider = useMemo(() => {
        const map = new Map<string, number>()

        for (const product of products) {
            for (const provider of product.providers) {
                map.set(provider.provider_code, (map.get(provider.provider_code) ?? 0) + 1)
            }
        }

        return map
    }, [products, products])
    const filteredProviders = useMemo(() => {
        return providers.filter((p) => productsByProvider.get(p.code) ?? 0 > 0)
    }, [providers, providersSelected])

    const allProviersCodes = useMemo(() => {
        return new Set<string>(filteredProviders.map((p) => p.code))
    }, [providers])

    const defaultValues = useMemo(() => {
        return Array.from(allProviersCodes).filter((code) => !providersSelected.has(code))
    }, [allProviersCodes, providersSelected])


    function handlefromDateChange(date: Date | undefined) {
        if (toDate && date) {
            setFromDate(date);
            const { list: consumptionStats, totalConsumedAmount, totalMotiveConsumption } = getConsumptionStats(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode)
            setConsumption(consumptionStats);
            setTotalConsumedAmount(totalConsumedAmount);
            setTotalMotiveConsumption(totalMotiveConsumption);
            const tempSales = getSalesAndBudgets(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
            setSalesAndBudgets(tempSales);
            const tempProportions = getSoldProportions(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
            setSoldProportions(tempProportions);
            const tempStatistics = getGeneralStatistics(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
            setGeneralStatistics(tempStatistics);

        }
    }


    function handletoDateChange(date: Date | undefined) {
        if (fromDate && date) {
            setToDate(date);
            const { list: consumptionStats, totalConsumedAmount, totalMotiveConsumption } = getConsumptionStats(fromDate, date, Array.from(unselectedClients), Array.from(providersSelected), productCode)
            setConsumption(consumptionStats);
            setTotalConsumedAmount(totalConsumedAmount);
            setTotalMotiveConsumption(totalMotiveConsumption);
            const tempSales = getSalesAndBudgets(fromDate, date, Array.from(unselectedClients), Array.from(providersSelected), productCode);
            setSalesAndBudgets(tempSales);
            const tempProportions = getSoldProportions(fromDate, date, Array.from(unselectedClients), Array.from(providersSelected), productCode);

            setSoldProportions(tempProportions);
            const tempStatistics = getGeneralStatistics(fromDate, date, Array.from(unselectedClients), Array.from(providersSelected), productCode);
            setGeneralStatistics(tempStatistics);        
        }
    }

    function getConsumptionStats(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string) {
        let events = data?.eventsByProductCode.get(productCode) ?? []
        let totalConsumedAmount = 0;
        const totalMotiveConsumption = new Map<string, number>();
        events = events.filter((event) =>
            new Date(String(event.date)) &&
            new Date(String(event.date)) >= fromDate && new Date(String(event.date)) <= toDate
        );
        const tupleToAmountMap = new Map<[string, string], number>()
        events.forEach((event) => {
            const assembliesQuantities = event.parentEvent && event.parentEvent.originalQuantity && event.parentEvent.originalQuantity - event.parentEvent.quantity;
            if (event.assemblyId) {
                const assembly = data?.assemblyById.get(event.assemblyId);
                let totalConsumptionOnEvent = (assembly?.quantity ?? 0) * (assembliesQuantities ?? 1);
                totalConsumedAmount += totalConsumptionOnEvent;
                let day = '';
                if (new Date(String(event.date)) instanceof Date && !isNaN(new Date(String(event.date)).getTime())) {
                    day = new Date(String(event.date)).toISOString().slice(0, 10);
                }

                const key: [string, string] = [day, event.parentEvent?.productCode ?? ''];
                const currentAmount = tupleToAmountMap.get(key) ?? 0;
                tupleToAmountMap.set(key, currentAmount + totalConsumptionOnEvent);
                const currentMotiveAmount = totalMotiveConsumption.get(event.parentEvent?.productCode ?? '') ?? 0;
                totalMotiveConsumption.set(event.parentEvent?.productCode ?? "", currentMotiveAmount + totalConsumptionOnEvent);
            }
        });

        let salesList: {
            date: string;
            motive: string;
            amount: number;
        }[] = [];
        const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code) && new Date(String(order.order_date)) && new Date(String(order.order_date)) >= fromDate && new Date(String(order.order_date)) <= toDate);
        sales.forEach((sale) => {
            const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
            const product = order_products?.find((order_product) => order_product.product_code === productCode);
            if (product) {
                salesList.push({
                    date: new Date(String(sale.order_date)).toISOString().slice(0, 10),
                    motive: "Venta Directa",
                    amount: product.ordered_quantity,
                }
                );
                const currentMotiveAmount = totalMotiveConsumption.get("Venta Directa") ?? 0;
                totalMotiveConsumption.set("Venta Directa", currentMotiveAmount + product.ordered_quantity);
                totalConsumedAmount += product.ordered_quantity;
            }
        })

        const eventsList = Array.from(tupleToAmountMap.entries()).map(([key, amount]) => {
            const [date, motive] = key;
            return { date, motive, amount };
        });



        return { list: [...eventsList, ...salesList], totalConsumedAmount, totalMotiveConsumption };
    }
    function getSalesAndBudgets(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string) {
        const fromDateCopy = new Date(fromDate);
        const budgets = data?.budgets.filter((budget) =>
            !clientExemptionList?.includes(budget.client_id) &&
            new Date(String(budget.date)) &&
            new Date(String(budget.date)) <= toDate &&
            new Date(String(budget.date)) >= fromDate &&
            budget.products.filter((product) => product.product_code === productCode).length > 0
        );
        const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code));
        let salesList = [];
        let budgetsList = [];
        while (fromDateCopy.getTime() <= toDate.getTime()) {
            const day = fromDate.toISOString().slice(0, 10);
            const salesOnDay = sales?.filter((sale) =>
                new Date(String(sale?.order_date)) instanceof Date && !isNaN(new Date(String(sale.order_date)).getTime()) &&
                new Date(String(sale.order_date)).toISOString().slice(0, 10) === day
            );
            const budgetsOnDay = budgets?.filter((budget) =>
                new Date(String(budget.date)) instanceof Date && !isNaN(new Date(String(budget.date)).getTime()) &&
                new Date(String(budget.date)).toISOString().slice(0, 10) === day
            );
            let totalSales = 0;
            salesOnDay?.forEach((sale) => {
                const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
                if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
                    const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
                    totalSales += order_product?.ordered_quantity ?? 0;
                }
            });
            salesList.push({ date: day, totalSales });
            let totalBudgets = 0;
            budgetsOnDay?.forEach((budget) => {
                const product = budget.products.find((product) => product.product_code === productCode);
                if (product) {
                    totalBudgets += product.quantity;
                }
            });
            budgetsList.push({ date: day, totalBudgets });

            fromDateCopy.setDate(fromDateCopy.getDate() + 1);
        }
        return { salesList, budgetsList };
    }
    function getSoldProportions(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string) {
        const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code) && new Date(String(order.order_date)) && new Date(String(order.order_date)) >= fromDate && new Date(String(order.order_date)) <= toDate);


        const clientInformation = new Map<string, [number, number]>()
        sales?.forEach((sale) => {
            const order_products = data?.orderProductsByOrderNumber.get(sale.order_number)
            if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
                const order_product = order_products?.find((order_product) => order_product.product_code === productCode)
                const [totalSales, amountOfSalse] = clientInformation.get(sale.client_code) ?? [0, 0];
                clientInformation.set(sale.client_code, [totalSales + (order_product?.ordered_quantity ?? 0), amountOfSalse + 1]);
            }
        });
        const clientList = Array.from(clientInformation.entries()).map(([key, value]) => {
            const [totalSales, amountOfSales] = value;

            return { name: data?.clients.find((client) => client.code === key)?.name, totalSales, amountOfSales, };
        });
        // salesList.push({ totalSales, averageSales: totalSales / (salesAmount), });
        return clientList;
    }
    function getGeneralStatistics(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string) {
        const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code) && new Date(String(order.order_date)) >= fromDate && new Date(String(order.order_date)) <= new Date(String(toDate)));
        let validOrderProducts: {
            id: number;
            order_number: string;
            product_code: string;
            ordered_quantity: number;
        }[] = []
        sales?.forEach((sale) => {
            const order_products = data?.orderProductsByOrderNumber.get(sale.order_number)
            if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
                const order_product = order_products?.find((order_product) => order_product.product_code === productCode)
                if (order_product) {
                    validOrderProducts.push(order_product);
                }
            }
        });
        const orderedQuantities = validOrderProducts.map((order_product) => order_product.ordered_quantity);
        const sortedQuantities = orderedQuantities.slice().sort((a, b) => a - b);
        const mid = Math.floor(sortedQuantities.length / 2);
        const median = sortedQuantities.length % 2 !== 0
            ? sortedQuantities[mid]
            : sortedQuantities[mid - 1];

        return {
            MaximumSales: orderedQuantities.length > 0 ? Math.max(...orderedQuantities) : 0,
            MinimumSales: orderedQuantities.length > 0 ? Math.min(...orderedQuantities) : 0,
            AverageSales: orderedQuantities.length > 0 ? orderedQuantities.reduce((acc, quantity) => acc + quantity, 0) / orderedQuantities.length : 0,
            TotalSales: orderedQuantities.length > 0 ? orderedQuantities.length : 0,
            MedianSales: orderedQuantities.length > 0 ? median : 0

        }
    }


    

    return (
        <AppLayout
            title={<div>
                <h1>{product?.description ?? "Producto no encontrado"}</h1>
                <p className='text-sm'>{product?.code ?? "Producto no encontrado"}</p>
            </div>
            }
            user={props?.user} sidenav={<AppSidenav />}>
            <div className="flex justify-between">
                <div className="flex gap-1">
                    <ListSelectionDialog
                        title='Proveedores'
                        options={filteredProviders.map((p) => ({
                            title: p.name,
                            subtitle: p.code + ' - ' + (p.address || '') + ' ' + ` - Productos: ${productsByProvider.get(p.code) ?? 0}`,
                            value: p.code,
                        }))}
                        defaultValues={defaultValues}
                        onApply={(selectedList) => {
                            const selected = new Set(selectedList)
                            const value = new Set<string>()
                            for (const provider of filteredProviders) {
                                if (!selected.has(provider.code)) {
                                    value.add(provider.code)
                                }
                            }                            
                            setProvidersSelected(value);
                            // re ejecute funciones estadistica
                        }}
                    >
                        <Button variant='outline' className="rounded-2xl bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-800 px-4 py-2">
                            Proveedores
                        </Button>
                    </ListSelectionDialog>
                    <SelectCRMClients setSelected={setSelected} unselected={unselectedClients} />
                </div>
                <div>
                    <DatePicker onChange={(e)=>handlefromDateChange(e)} value={fromDate ?? undefined} message="Fecha desde" />
                    <DatePicker onChange={(e)=>handletoDateChange(e)} value={toDate ?? undefined} message="Fecha hasta" />
                </div>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 mt-6">
                <h1 className="font-bold text-2xl text-gray-800 mb-4">Estadísticas generales</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <p className="font-medium text-lg text-gray-700">
                        Ventas totales: <span className="font-normal text-gray-600">{generalStatistics.TotalSales}</span>
                    </p>
                    <p className="font-medium text-lg text-gray-700">
                        Máximo histórico: <span className="font-normal text-gray-600">{generalStatistics.MaximumSales}</span>
                    </p>
                    <p className="font-medium text-lg text-gray-700">
                        Mínimo histórico: <span className="font-normal text-gray-600">{generalStatistics.MinimumSales}</span>
                    </p>
                    <p className="font-medium text-lg text-gray-700">
                        Ventas promedio: <span className="font-normal text-gray-600">{generalStatistics.AverageSales}</span>
                    </p>
                    <p className="font-medium text-lg text-gray-700">
                        Mediana de ventas: <span className="font-normal text-gray-600">{generalStatistics.MedianSales}</span>
                    </p>
                </div>
                <br />
                <h1 className="font-bold text-2xl text-gray-800 mb-4">Estadísticas de consumo</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from(totalMotiveConsumption.entries()).map(([motive, amount]) => (
                        <p className="font-medium text-lg text-gray-700">
                            {motive}: <span className="font-normal text-gray-600">{Math.round(100 * amount / totalConsumedAmount)}% del consumo</span>
                        </p>
                    ))}
                </div>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 mt-6">
                <h1 className="font-bold text-2xl text-gray-800 mb-6">Graficos</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-6 items-center">
                    <StackedAreaChart data={consumption} />
                    <SimpleBartChart data={soldProportions} />
                    <SimpleLineChart data={salesAndBudgets} />
                </div>
            </div>
        </AppLayout>
    )
}