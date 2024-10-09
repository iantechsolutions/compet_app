"use client";
import { ring2 } from "ldrs";

import { useParams } from "next/navigation";
import { AreaChart, ChevronDownIcon, ChevronUpIcon, Filter, Loader2Icon, XSquareIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { useMRPData } from "~/components/mrp-data-provider";
import { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { MRPProduct } from "~/mrp_data/transform_mrp_data";
import { FixedSizeList as List } from "react-window";
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
} from "~/components/ui/alert-dialog";
import { CrmBudget } from "~/lib/types";
import { formatStock } from "~/lib/utils";
import { SelectCRMClients } from "../../forecast/select-crm-clients";
import { string } from "zod";
import StackedAreaChart from "~/components/estadisticas/stackedAreaChart";
import SimpleLineChart from "~/components/estadisticas/simpleLineChart";
import SimpleBartChart from "~/components/estadisticas/simpleBartChart";
import { DatePicker } from "~/components/day-picker";
import dayjs from "dayjs";
import DataCard from "~/components/ui/dataCard";
import { ChartNoAxesCombined } from "~/components/icons/chart-combined";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import ListSelectionDialog from "~/components/list-selection-dialog";
import SimpleBartChartRecuts from "~/components/estadisticas/simpleBartChartRecuts";
export default function StatisticsPage(props: { user?: NavUserData }) {
  const temporaryDate = new Date();
  temporaryDate.setFullYear(temporaryDate.getFullYear() - 1);
  const [fromDate, setFromDate] = useState<Date | undefined>(temporaryDate);
  const [isLoading, setIsLoading] = useState(true);
  const [handleFiltersStage, setHandleFiltersStage] = useState(0);
  const data = useMRPData();
  const params = useParams<{ code: string }>();
  const productCode = decodeURIComponent(params?.code ?? "");
  const product: MRPProduct | null = data.products.find((p) => p.code === productCode) ?? null;
  const providers = data.providers;
  const products = data.products;
  const [providersSelected, setProvidersSelected] = useState<Set<string>>(new Set());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [unselectedClients, setSelected] = useState<Set<string>>(new Set());
  const [consumption, setConsumption] = useState<
    {
      date: string;
      motive: string;
      amount: number;
    }[]
  >();


  const [salesAndBudgets, setSalesAndBudgets] = useState<{
    salesList: { date: string; totalSales: number }[];
    budgetsList: { date: string; totalBudgets: number }[];
  }>();
  const [soldProportions, setSoldProportions] = useState<{ name: string | undefined; totalSales: number; amountOfSales: number }[]>();
  const [generalStatistics, setGeneralStatistics] = useState<{
    MaximumSales: number;
    MinimumSales: number;
    AverageSales: number;
    TotalSales: number;
    MedianSales: number | undefined;
  }>();
  const [totalConsumedAmount, setTotalConsumedAmount] = useState<number>();
  const [totalMotiveConsumption, setTotalMotiveConsumption] = useState<Map<string, number>>();
  const [hasRun, setHasRun] = useState<boolean>(false);
  ring2.register();
  useEffect(() => {
    if (fromDate && toDate && !hasRun) {
      const {
        list: consumptionStats,
        totalConsumedAmount: totalTemp,
        totalMotiveConsumption: totalMotiveTemp,
      } = getConsumptionStats(
        new Date("2023-09-04"),
        new Date(),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      const tempSales = getSalesAndBudgets(
        fromDate ?? new Date("2023-09-04"),
        toDate ?? new Date("2024-09-04"),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      const tempSoldProportions = getSoldProportions(
        fromDate ?? new Date("2023-09-04"),
        toDate ?? new Date("2024-09-04"),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      const tempGeneral = getGeneralStatistics(
        fromDate ?? new Date("2023-09-04"),
        toDate ?? new Date("2024-09-04"),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      setConsumption(consumptionStats);
      setTotalConsumedAmount(totalTemp);
      setTotalMotiveConsumption(totalMotiveTemp);
      setSalesAndBudgets(tempSales);
      setSoldProportions(tempSoldProportions);
      setGeneralStatistics(tempGeneral);
      setHasRun(true);
      setIsLoading(false);
    }
  }, [fromDate, toDate]);

  const productsByProvider = useMemo(() => {
    const map = new Map<string, number>();

    for (const product of products) {
      for (const provider of product.providers) {
        map.set(provider.provider_code, (map.get(provider.provider_code) ?? 0) + 1);
      }
    }

    return map;
  }, [products, products]);
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => productsByProvider.get(p.code) ?? 0 > 0);
  }, [providers, providersSelected]);

  const allProviersCodes = useMemo(() => {
    return new Set<string>(filteredProviders.map((p) => p.code));
  }, [providers]);

  const defaultValues = useMemo(() => {
    return Array.from(allProviersCodes).filter((code) => !providersSelected.has(code));
  }, [allProviersCodes, providersSelected]);

  function handleUpdateFilters() {
    if (fromDate && toDate) {
      try {
        const {
          list: consumptionStats,
          totalConsumedAmount,
          totalMotiveConsumption,
        } = getConsumptionStats(fromDate, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
        setConsumption(consumptionStats);
        setTotalConsumedAmount(totalConsumedAmount);
        setTotalMotiveConsumption(totalMotiveConsumption);
        const tempSales = getSalesAndBudgets(fromDate, toDate, Array.from(unselectedClients), Array.from(providersSelected), productCode);
        setSalesAndBudgets(tempSales);
        const tempProportions = getSoldProportions(
          fromDate,
          toDate,
          Array.from(unselectedClients),
          Array.from(providersSelected),
          productCode,
        );
        setSoldProportions(tempProportions);
        const tempStatistics = getGeneralStatistics(
          fromDate,
          toDate,
          Array.from(unselectedClients),
          Array.from(providersSelected),
          productCode,
        );
        setGeneralStatistics(tempStatistics);
        setIsLoading(false);
      } catch (e) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (handleFiltersStage === 1) {
      // le doy tiempo a react para renderizar el loader antes de que se congele todo
      setTimeout(() => setHandleFiltersStage(2), 150);
    } else if (handleFiltersStage === 2) {
      handleUpdateFilters();
      setHandleFiltersStage(0);
    }
  }, [handleFiltersStage]);

  function handleUpdateFiltersLoad() {
    setHandleFiltersStage(1);
    setIsLoading(true);
  }

  function handletoDateChange(date: Date | undefined) {
    if (date) {
      setToDate(date);
    }
  }

  function getConsumptionStats(
    fromDate: Date,
    toDate: Date,
    clientExemptionList: string[] | null,
    providerExemptionList: string[] | null,
    productCode: string,
  ) {
    let events = data?.eventsByProductCode.get(productCode) ?? [];
    let totalConsumedAmount = 0;
    const totalMotiveConsumption = new Map<string, number>();
    events = events.filter(
      (event) => new Date(String(event.date)) && new Date(String(event.date)) >= fromDate && new Date(String(event.date)) <= toDate,
    );
    const tupleToAmountMap = new Map<[string, string], number>();
    events.forEach((event) => {
      const assembliesQuantities =
        event.parentEvent && event.parentEvent.originalQuantity && event.parentEvent.originalQuantity - event.parentEvent.quantity;
      if (event.assemblyId) {
        const assembly = data?.assemblyById.get(event.assemblyId);
        let totalConsumptionOnEvent = (assembly?.quantity ?? 0) * (assembliesQuantities ?? 1);
        totalConsumedAmount += totalConsumptionOnEvent;
        let day = "";
        if (new Date(String(event.date)) instanceof Date && !isNaN(new Date(String(event.date)).getTime())) {
          day = new Date(String(event.date)).toISOString().slice(0, 10);
        }

        const key: [string, string] = [day, event.parentEvent?.productCode ?? ""];
        const currentAmount = tupleToAmountMap.get(key) ?? 0;
        tupleToAmountMap.set(key, currentAmount + totalConsumptionOnEvent);
        const currentMotiveAmount = totalMotiveConsumption.get(event.parentEvent?.productCode ?? "") ?? 0;
        totalMotiveConsumption.set(event.parentEvent?.productCode ?? "", currentMotiveAmount + totalConsumptionOnEvent);
      }
    });

    let salesList: {
      date: string;
      motive: string;
      amount: number;
    }[] = [];
    const sales = data?.orders.filter(
      (order) =>
        !clientExemptionList?.includes(order.client_code) &&
        new Date(String(order.order_date)) &&
        new Date(String(order.order_date)) >= fromDate &&
        new Date(String(order.order_date)) <= toDate,
    );
    sales.forEach((sale) => {
      const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
      const product = order_products?.find((order_product) => order_product.product_code === productCode);
      if (product) {
        salesList.push({
          date: new Date(String(sale.order_date)).toISOString().slice(0, 10),
          motive: "Venta Directa",
          amount: product.ordered_quantity,
        });
        const currentMotiveAmount = totalMotiveConsumption.get("Venta Directa") ?? 0;
        totalMotiveConsumption.set("Venta Directa", currentMotiveAmount + product.ordered_quantity);
        totalConsumedAmount += product.ordered_quantity;
      }
    });

    const eventsList = Array.from(tupleToAmountMap.entries()).map(([key, amount]) => {
      const [date, motive] = key;
      return { date, motive, amount };
    });

    return {
      list: [...eventsList, ...salesList],
      totalConsumedAmount,
      totalMotiveConsumption,
    };
  }
  function getSalesAndBudgets(
    fromDate: Date,
    toDate: Date,
    clientExemptionList: string[] | null,
    providerExemptionList: string[] | null,
    productCode: string,
  ) {
    const fromDateCopy = new Date(fromDate);
    const budgets = data?.budgets.filter(
      (budget) =>
        !clientExemptionList?.includes(budget.client_id) &&
        new Date(String(budget.date)) &&
        new Date(String(budget.date)) <= toDate &&
        new Date(String(budget.date)) >= fromDateCopy &&
        budget.products.filter((product) => product.product_code === productCode).length > 0,
    );
    const sales = data?.orders.filter((order) => !clientExemptionList?.includes(order.client_code));
    let salesList = [];
    let budgetsList = [];
    while (fromDateCopy.getTime() <= toDate.getTime()) {
      const day = fromDateCopy.toISOString().slice(0, 10);
      const salesOnDay = sales?.filter(
        (sale) =>
          new Date(String(sale?.order_date)) instanceof Date &&
          !isNaN(new Date(String(sale.order_date)).getTime()) &&
          new Date(String(sale.order_date)).toISOString().slice(0, 10) === day,
      );
      const budgetsOnDay = budgets?.filter(
        (budget) =>
          new Date(String(budget.date)) instanceof Date &&
          !isNaN(new Date(String(budget.date)).getTime()) &&
          new Date(String(budget.date)).toISOString().slice(0, 10) === day,
      );
      let totalSales = 0;
      salesOnDay?.forEach((sale) => {
        const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
        if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
          const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
          totalSales += order_product?.ordered_quantity ?? 0;
        }
      });
      if (totalSales > 0) {
        salesList.push({ date: day, totalSales });
      }
      let totalBudgets = 0;
      budgetsOnDay?.forEach((budget) => {
        const product = budget.products.find((product) => product.product_code === productCode);
        if (product) {
          totalBudgets += product.quantity;
        }
      });
      if (totalBudgets > 0) {
        budgetsList.push({ date: day, totalBudgets });
      }


      fromDateCopy.setDate(fromDateCopy.getDate() + 1);
    }
    return { salesList, budgetsList };
  }
  function getSoldProportions(
    fromDate: Date,
    toDate: Date,
    clientExemptionList: string[] | null,
    providerExemptionList: string[] | null,
    productCode: string,
  ) {
    const sales = data?.orders.filter(
      (order) =>
        !clientExemptionList?.includes(order.client_code) &&
        new Date(String(order.order_date)) &&
        new Date(String(order.order_date)) >= fromDate &&
        new Date(String(order.order_date)) <= toDate,
    );

    const clientInformation = new Map<string, [number, number]>();
    sales?.forEach((sale) => {
      const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
      if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
        const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
        const [totalSales, amountOfSalse] = clientInformation.get(sale.client_code) ?? [0, 0];
        clientInformation.set(sale.client_code, [totalSales + (order_product?.ordered_quantity ?? 0), amountOfSalse + 1]);
      }
    });
    const clientList = Array.from(clientInformation.entries()).map(([key, value]) => {
      const [totalSales, amountOfSales] = value;

      return {
        name: data?.clients.find((client) => client.code === key)?.name,
        totalSales,
        amountOfSales,
      };
    });
    // salesList.push({ totalSales, averageSales: totalSales / (salesAmount), });
    return clientList;
  }
  function getGeneralStatistics(
    fromDate: Date,
    toDate: Date,
    clientExemptionList: string[] | null,
    providerExemptionList: string[] | null,
    productCode: string,
  ) {


    const sales = data?.orders.filter(
      (order) =>
        !clientExemptionList?.includes(order.client_code) &&
        new Date(String(order.order_date)) >= fromDate &&
        new Date(String(order.order_date)) <= new Date(String(toDate)),
    );
    let validOrderProducts: {
      id: number;
      order_number: string;
      product_code: string;
      ordered_quantity: number;
    }[] = [];
    sales?.forEach((sale) => {
      const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
      if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
        const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
        if (order_product) {
          validOrderProducts.push(order_product);
        }
      }
    });



    let events = data?.eventsByProductCode.get(productCode) ?? [];
    events = events.filter(
      (event) => new Date(String(event.date)) && new Date(String(event.date)) >= fromDate && new Date(String(event.date)) <= toDate,
    );
    events.forEach((event) => {
      // event.quantity
      if (event.assemblyId) {
        const assembliesQuantities =
          event.parentEvent && event.parentEvent.originalQuantity && event.parentEvent.originalQuantity - event.parentEvent.quantity;
        const assembly = data?.assemblyById.get(event.assemblyId);
        let totalConsumptionOnEvent = (assembly?.quantity ?? 0) * (assembliesQuantities ?? 1);
        let day = "";
        if (new Date(String(event.date)) instanceof Date && !isNaN(new Date(String(event.date)).getTime())) {
          day = new Date(String(event.date)).toISOString().slice(0, 10);
        }
        validOrderProducts.push({
          id: 0,
          order_number: "",
          product_code: productCode,
          ordered_quantity: totalConsumptionOnEvent,
        });
      }
    })

    //utility
    const difference = dayjs(fromDate).diff(dayjs(toDate), 'month');

    //passed values
    const orderedQuantities = validOrderProducts.map((order_product) => order_product.ordered_quantity);
    const sortedQuantities = orderedQuantities.slice().sort((a, b) => a - b);
    const mid = Math.floor(sortedQuantities.length / 2);
    const median = sortedQuantities.length % 2 !== 0 ? sortedQuantities[mid] : sortedQuantities[mid - 1];
    const averageSalesPerMonth = validOrderProducts.reduce((acc, order_product) => acc + order_product.ordered_quantity, 0) / difference;
    return {
      MaximumSales: orderedQuantities.length > 0 ? Math.max(...orderedQuantities) : 0,
      MinimumSales: orderedQuantities.length > 0 ? Math.min(...orderedQuantities) : 0,
      AverageSales:
        orderedQuantities.length > 0 ? orderedQuantities.reduce((acc, quantity) => acc + quantity, 0) / orderedQuantities.length : 0,
      TotalSales: orderedQuantities.length > 0 ? orderedQuantities.length : 0,
      MedianSales: orderedQuantities.length > 0 ? median : 0,
    };
  }
  const [showMore, setShowMore] = useState(false);

  const toggleShowMore = () => {
    setShowMore((showMore) => !showMore);
  };

  const [showMore2, setShowMore2] = useState(false);

  const toggleShowMore2 = () => {
    setShowMore2((showMore2) => !showMore2);
  };

  if (isLoading) {
    return (
      <AppLayout
        title={
          <div>
            <h1>{product?.description ?? "Producto no encontrado"}</h1>
            <p className="text-sm">{product?.code ?? "Producto no encontrado"}</p>
          </div>
        }
        user={props?.user}
        sidenav={<AppSidenav />}
      >
        <div className="flex justify-between">
          <div className="flex gap-3">
            <ListSelectionDialog
              title="Proveedores"
              options={filteredProviders.map((p) => ({
                title: p.name,
                subtitle: p.code + " - " + (p.address || "") + " " + ` - Productos: ${productsByProvider.get(p.code) ?? 0}`,
                value: p.code,
              }))}
              defaultValues={defaultValues}
              onApply={(selectedList) => {
                const selected = new Set(selectedList);
                const value = new Set<string>();
                for (const provider of filteredProviders) {
                  if (!selected.has(provider.code)) {
                    value.add(provider.code);
                  }
                }
                setProvidersSelected(value);
              }} >
              <Button
                variant="outline"
                className="rounded-2xl border-[#8B83EC] bg--50 px-4 py-2 text-gray-700 hover:border-gray-400 hover:bg-gray-100 hover:text-gray-800"
              >
                Proveedores
              </Button>
            </ListSelectionDialog>
            <SelectCRMClients setSelected={setSelected} unselected={unselectedClients} />
          </div>
          <div className="flex ml-3 gap-3">
            <DatePicker onChange={(e) => setFromDate(e)} value={fromDate ?? undefined} message="Fecha desde" label={""} />
            <DatePicker onChange={(e) => handletoDateChange(e)} value={toDate ?? undefined} message="Fecha hasta" label={""} />
            <Button
              onClick={handleUpdateFilters}
              className="rounded-2xl border-[#8B83EC] bg-black px-4 py-2 text-gray-200 hover:border-gray-800 hover:bg-gray-900 hover:text-gray-100"
            >
              Filtrar
            </Button>
          </div>
        </div>
        <div className="mt-6 rounded-lg bg-white p-6 shadow-md">
          <l-ring-2 size="40" stroke="5" stroke-length="0.25" bg-opacity="0.1" speed="0.8" color="black"></l-ring-2>
          CARGANDO
        </div>
      </AppLayout>
    );
  } else {
    return (
      <AppLayout
        title={
          <div>
            <h1>{product?.description ?? "Producto no encontrado"}</h1>
            <p className="text-sm">{product?.code ?? "Producto no encontrado"}</p>
          </div>
        }
        user={props?.user}
        sidenav={<AppSidenav />}
      >
        <div className="flex justify-between">
          <div className="flex gap-1">
            <ListSelectionDialog
              title="Proveedores"
              options={filteredProviders.map((p) => ({
                title: p.name,
                subtitle: p.code + " - " + (p.address || "") + " " + ` - Productos: ${productsByProvider.get(p.code) ?? 0}`,
                value: p.code,
              }))}
              defaultValues={defaultValues}
              onApply={(selectedList) => {
                const selected = new Set(selectedList);
                const value = new Set<string>();
                for (const provider of filteredProviders) {
                  if (!selected.has(provider.code)) {
                    value.add(provider.code);
                  }
                }
                setProvidersSelected(value);
                // re ejecute funciones estadistica
              }}
            >
              <Button
                variant="outline"
                className="rounded-2xl border-gray-300 bg-gray-50 px-4 py-2 text-gray-700 hover:border-gray-400 hover:bg-gray-100 hover:text-gray-800"
              >
                Proveedores
              </Button>
            </ListSelectionDialog>
            <SelectCRMClients setSelected={setSelected} unselected={unselectedClients} />
          </div>
          <div className="flex gap-3">
            <DatePicker onChange={(e) => setFromDate(e)} value={fromDate ?? undefined} label="Desde" message="Desde" />
            <DatePicker onChange={(e) => handletoDateChange(e)} value={toDate ?? undefined} label="Hasta" />
            <Button
              onClick={handleUpdateFilters}
              className="rounded-lg border-purple-200 bg-[#8B83EC] px-4 py-2 text-gray-200 hover:border-gray-800 hover:bg-gray-900 hover:text-gray-100"
            >
              <Filter className="mr-2" size={20} />Filtrar
            </Button>
          </div>
        </div>

        {isLoading || handleFiltersStage > 0 ? <>
          <div className="flex items-center justify-center" style={{ minHeight: '70vh' }}>
            <Button variant="secondary" disabled>
              <Loader2Icon className="mr-2 animate-spin" /> Cargando...
            </Button>
          </div>
        </> : <>
          <DataCard icon={<ChartNoAxesCombined />} title={"Estadísticas generales"}>
            <TooltipProvider>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{generalStatistics?.TotalSales ?? 0}</p>
                    <p className="text-sm font-medium text-black mt-2">Ventas Totales</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ventas Totales: todas las veces que se vendió ese producto.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{generalStatistics?.TotalSales ?? 0}</p>
                    <p className="text-sm font-medium text-black mt-2">Cantidad de Pedidos</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cantidad de pedidos que incluye este elemento.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{generalStatistics?.MaximumSales ?? 0}</p>
                    <p className="text-sm font-medium text-black mt-2">Máximo UVP</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Máximas unidades vendidas por pedido.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">{generalStatistics?.MinimumSales ?? 0}</p>
                        <p className="text-sm font-medium text-black mt-2">Mínimo UVP</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mínimas unidades vendidas por pedido.</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">{generalStatistics?.AverageSales ?? 0}</p>
                        <p className="text-sm font-medium text-black mt-2">UPP</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Unidades promedio por pedido.</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">{generalStatistics?.MedianSales ?? 0}</p>
                        <p className="text-sm font-medium text-black mt-2">Mediana UVP</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mediana de unidades por venta.</p>
                      </TooltipContent>
                    </Tooltip>

                {/* {showMore && (
                  <>
                    <Tooltip>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">{generalStatistics?.MinimumSales ?? 0}</p>
                        <p className="text-sm font-medium text-black mt-2">Mínimo UVP</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mínimas unidades vendidas por pedido.</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">{generalStatistics?.AverageSales ?? 0}</p>
                        <p className="text-sm font-medium text-black mt-2">UPP</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Unidades promedio por pedido.</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">{generalStatistics?.MedianSales ?? 0}</p>
                        <p className="text-sm font-medium text-black mt-2">Mediana UVP</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mediana de unidades por venta.</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
                 */}
              </div>

              {/* <div className="flex justify-end items-center mt-4 cursor-pointer space-x-2" onClick={toggleShowMore}>
                <p className="text-xs text-grey-700">{showMore ? "Mostrar menos" : "Mostrar más"}</p>
                {showMore ? (
                  <ChevronUpIcon className="h-4 w-3 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="h-4 w-3 text-gray-500" />
                )}
              </div> */}



            </TooltipProvider>
          </DataCard>
          <DataCard icon={<ChartNoAxesCombined />} title={"DISTRIBUCIÓN DE CONSUMO"}>
            {!totalConsumedAmount && <p>No hay información de consumo disponible</p>}
            <TooltipProvider>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {totalMotiveConsumption
                  ? Array.from(totalMotiveConsumption.entries()).map(([motive, amount]) => (
                    <Tooltip key={motive}>
                      <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                        <p className="text-5xl font-bold text-black">
                          {Math.round((100 * amount) / (totalConsumedAmount ?? 1))}%
                        </p>
                        <p className="text-sm font-medium text-black mt-2">{motive}</p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {motive}: {amount} unidades consumidas, lo que representa{" "}
                          {Math.round((100 * amount) / (totalConsumedAmount ?? 1))}% del consumo total.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))
                  : "no hay información de consumo disponible"}
              </div>
            </TooltipProvider>
            <div className="flex justify-end items-center mt-4 cursor-pointer space-x-2" onClick={toggleShowMore2}>
              <p className="text-xs text-grey-700">{showMore2 ? "Mostrar menos" : "Mostrar más"}</p>
              {showMore2 ? (
                <ChevronUpIcon className="h-4 w-3 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-4 w-3 text-gray-500" />
              )}
            </div>
          </DataCard>
        </>
        }
        <DataCard title="GRAFICOS" icon={<AreaChart />}>
          <div className="flex flex-wrap gap-x-4 mb-12 w-max-[1077px]">
            <StackedAreaChart data={consumption ?? []} />
            <SimpleBartChart data={soldProportions ?? []} />
          </div>
          <div className="flex flex-wrap gap-x-4 mb-12 w-max-[1077px]">
            <SimpleLineChart data={salesAndBudgets} />
            <SimpleBartChartRecuts/>
          </div>
        </DataCard>
      </AppLayout >
    );
  }
}
