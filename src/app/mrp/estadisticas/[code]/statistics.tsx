"use client"
import { useParams } from "next/navigation";
import { CheckCheckIcon, CheckIcon, XSquareIcon } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState } from "react";
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
export default function StatisticsPage(props: { user?: NavUserData }) {
    const data = useMRPData();
    const params = useParams<{ code: string }>()
    const productCode = decodeURIComponent(params?.code ?? '')
    const product: MRPProduct | null = data.products.find((p) => p.code === productCode) ?? null
    const providers = data.providers;
    const products = data.products;
    const [providersSelected, setProvidersSelected] = useState<Set<string>>(new Set());
    const temporaryDate = new Date();
    temporaryDate.setFullYear(temporaryDate.getFullYear() - 1);
    const [fromDate,setFromDate] = useState<Date>(temporaryDate);
    const [toDate,setToDate] = useState<Date>(new Date());
    const [consumption, setConsumption] = useState<{
        date: string;
        motive: string;
        amount: number;
    }[]>([]);
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


    function handlefromDateChange(date:Date){
        
        setConsumption(getConsumptionStats(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode));
        getSalesAndBudgets(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
        getSoldProportions(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
        getGeneralStatistics(date, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
    }


    function getConsumptionStats(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string) {
        let events = data?.eventsByProductCode.get(productCode) ?? []
        events = events.filter((event) => 
                // event.referenceId === orderProduct.id
        new Date(String(event.date)) &&
        new Date(String(event.date))  >= fromDate && new Date(String(event.date)) <= toDate
        );
        const tupleToAmountMap = new Map<[string,string], number>()
        events.forEach((event) => {
            const assembliesQuantities = event.parentEvent && event.parentEvent.originalQuantity && event.parentEvent.originalQuantity - event.parentEvent.quantity;
            if (event.assemblyId) {
                const assembly = data?.assemblyById.get(event.assemblyId);
                let totalConsumptionOnEvent = (assembly?.quantity ?? 0) * (assembliesQuantities ?? 1);
                
                let day = '';
                if (new Date(String(event.date)) instanceof Date && !isNaN(new Date(String(event.date)).getTime())) {
                    day = new Date(String(event.date)).toISOString().slice(0, 10);
                }
                
                const key: [string, string] = [day, event.parentEvent?.productCode ?? ''];
                const currentAmount = tupleToAmountMap.get(key) ?? 0;
                tupleToAmountMap.set(key, currentAmount + totalConsumptionOnEvent);
            }
        });

        const list = Array.from(tupleToAmountMap.entries()).map(([key, amount]) => {
            const [date, motive] = key;
            return { date, motive, amount };
        });
        return list;
    }
    function getSalesAndBudgets(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string) {
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
        while (fromDate.getTime() <= toDate.getTime()) {
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
            
            fromDate.setDate(fromDate.getDate() + 1);
        }
        return { salesList, budgetsList };
    }
    function getSoldProportions(fromDate: Date, toDate: Date, clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string){
        const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code) &&  new Date(String(order.order_date)) && new Date(String(order.order_date)) >= fromDate && new Date(String(order.order_date)) <= toDate);
        
        
        const clientInformation = new Map<string, [number,number]>()
        sales?.forEach((sale) => {
            const order_products = data?.orderProductsByOrderNumber.get(sale.order_number)
            if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0){
                const order_product = order_products?.find((order_product) => order_product.product_code === productCode)
                const [totalSales, amountOfSalse ] = clientInformation.get(sale.client_code) ?? [0,0];            
                clientInformation.set(sale.client_code, [totalSales + (order_product?.ordered_quantity ?? 0), amountOfSalse + 1]);
            }
        });
        const clientList = Array.from(clientInformation.entries()).map(([key, value]) => {
            const [totalSales, amountOfSales] = value;
            
            return { name:data?.clients.find((client) => client.code === key)?.name, totalSales, amountOfSales,      };
        });
        // salesList.push({ totalSales, averageSales: totalSales / (salesAmount), });
        return clientList;
    }
    function getGeneralStatistics(fromDate:Date,toDate:Date,clientExemptionList: string[] | null, providerExemptionList: string[] | null, productCode: string){
        const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code) && new Date(String(order.order_date)) >= fromDate && new Date(String(order.order_date)) <= new Date(String(toDate)));
        let validOrderProducts:{
            id: number;
            order_number: string;
            product_code: string;
            ordered_quantity: number;
        }[] = []
        sales?.forEach((sale) => {
            const order_products = data?.orderProductsByOrderNumber.get(sale.order_number)
            if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0){
                const order_product = order_products?.find((order_product) => order_product.product_code === productCode)
                if (order_product){
                validOrderProducts.push(order_product);   
                }
            }
        });
        const orderedQuantities = validOrderProducts.map((order_product) => order_product.ordered_quantity);
        const sortedQuantities = orderedQuantities.slice().sort((a, b) => a - b);
        const mid = Math.floor(sortedQuantities.length / 2);
        const median = sortedQuantities.length % 2 !== 0 ? sortedQuantities[mid] : ((sortedQuantities[mid - 1] ?? 0 ) + (sortedQuantities[mid] ?? 0)) / 2;
    
        return {
            MaximumSales: Math.max(...orderedQuantities),
            MinimumSales: Math.min(...orderedQuantities),
            AverageSales: orderedQuantities.reduce((acc, quantity) => acc + quantity, 0) / orderedQuantities.length,
            TotalSales: orderedQuantities.length,
            MedianSales: median
    
        }
    }


    const [unselectedClients, setSelected] = useState<Set<string>>(new Set())
    // setConsumption();
    console.log("consumption");
    console.log(getConsumptionStats(new Date('2023-09-04'), new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode));
    const salesAndBudgets = getSalesAndBudgets(new Date('2023-09-04'), new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode);
    console.log("salesAndBudgets");
    console.log(salesAndBudgets);
    const soldProportions = getSoldProportions(new Date('2023-09-04'), new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode);
    console.log("soldProportions");
    console.log(soldProportions);
    const generalStatistics = getGeneralStatistics(new Date('2023-09-04'), new Date('2024-09-04'), Array.from(unselectedClients), Array.from(providersSelected), productCode);
    console.log("generalStatistics");
    console.log(generalStatistics);
    return (
        <AppLayout 
        title={<div>
                    <h1>{product?.description ?? "Producto no encontrado"}</h1>
                    <p className='text-sm'>{product?.code ?? "Producto no encontrado"}</p>
               </div>
                } 
        user={props?.user} sidenav={<AppSidenav />}>


            <h1>Proveedores</h1>

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
                console.log(providersSelected);
                setProvidersSelected(value);
            }}
        >
            <Button variant='outline'>Ocultar o mostrar proveedores</Button>
            </ListSelectionDialog>
            <h1>Clientes</h1>
            <SelectCRMClients setSelected={setSelected} unselected={unselectedClients} />
        </AppLayout>
    )
}