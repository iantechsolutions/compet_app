"use client";
import { ring2 } from "ldrs";

import { useParams } from "next/navigation";
import { AreaChart, ChevronDownIcon, ChevronUpIcon, Filter, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import type { NavUserData } from "~/components/nav-user-section";
import { Button } from "~/components/ui/button";
import { isSemiElaborate } from "~/lib/utils";
import { SelectCRMClients } from "../../forecast/select-crm-clients";
import StackedAreaChart from "~/components/estadisticas/stackedAreaChart";
import SimpleLineChart from "~/components/estadisticas/simpleLineChart";
import ClientUnitsSold from "~/components/estadisticas/simpleBartChart";
import { DatePicker } from "~/components/day-picker";
import DataCard from "~/components/ui/dataCard";
import { ChartNoAxesCombined } from "~/components/icons/chart-combined";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import ListSelectionDialog from "~/components/list-selection-dialog";
import SimpleBartChartRecuts from "~/components/estadisticas/simpleBartChartRecuts";
import { useMRPData } from "~/components/mrp-data-provider";

export default function StatisticsPage(props: { user?: NavUserData }) {
  const temporaryDate = new Date();
  temporaryDate.setFullYear(temporaryDate.getFullYear() - 1);

  const [fromDate, setFromDate] = useState<Date | undefined>(temporaryDate);
  const [isLoading, setIsLoading] = useState(true);
  const [handleFiltersStage, setHandleFiltersStage] = useState(0);
  const params = useParams<{ code: string }>();
  const productCode = decodeURIComponent(params?.code ?? "");
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
  const [soldProportions, setSoldProportions] = useState<{ name: string; totalSales: number; amountOfSales: number }[]>();
  const [generalStatistics, setGeneralStatistics] = useState<{
    maxSales: number;
    minSales: number;
    avgSales: number;
    totalSales: number;
    totalSaleCount: number;
    medianSales: number | undefined;
  }>();

  const [cuts, setCuts] = useState<Map<string, number>>();
  const [totalConsumedAmount, setTotalConsumedAmount] = useState<number>();
  const [totalMotiveConsumption, setTotalMotiveConsumption] = useState<Map<string, number>>();
  const [hasRun, setHasRun] = useState<boolean>(false);

  const [showMore, setShowMore] = useState(false);
  const [showMore2, setShowMore2] = useState(false);

  /* const { data: providers, isLoading: isLoadingProv } = api.db.getMProviders.useQuery();
  const { data: eventsByProductCode, isLoading: isLoadingEvts } = api.db.getMEventsByProductCode.useQuery();
  const { data: products, isLoading: isLoadingProds } = api.db.getMProductsWSuppliesOf.useQuery();
  const { data: assemblyById, isLoading: isLoadingAssemb } = api.db.getMAssemblyById.useQuery();
  const { data: budget_products, isLoading: isLoadingBP } = api.db.getMBudgetProducts.useQuery();
  const { data: budgetsById, isLoading: isLoadingBID } = api.db.getMBudgetsById.useQuery();
  const { data: clients, isLoading: isLoadingClients } = api.db.getMClients.useQuery();
  const { data: crm_clients, isLoading: isLoadingCRMC } = api.db.getMCrmClients.useQuery();
  const { data: budgets, isLoading: isLoadingBudgets } = api.db.getMBudgets.useQuery();
  const { data: sold, isLoading: isLoadingSold } = api.db.getMSold.useQuery();
  const loading = isLoadingClients || isLoadingSold || isLoadingBudgets || isLoadingCRMC || isLoadingBID || isLoadingProv || isLoadingProds || isLoadingEvts || isLoadingAssemb || isLoadingBP; */
  const mrpData = useMRPData();
  const {
    products_sold,
    providers,
    eventsByProductCode,
    products,
    assemblyById,
    budget_products,
    budgetsById,
    clients,
    crm_clients,
    budgets,
    sold
  } = mrpData;

  const indexedEvents = mrpData.events ?? [];

  ring2.register();
  const productsByProvider = useMemo(() => {
    const start = Date.now();
    const map = new Map<string, number>();

    for (const product of products) {
      for (const provider of product.providers) {
        map.set(provider.provider_code, (map.get(provider.provider_code) ?? 0) + 1);
      }
    }

    console.log('productsByProvider elapsed', Date.now() - start);

    return map;
  }, [products]);

  const productProductsSold = useMemo(() => {
    return products_sold.filter(v => v.product_code === productCode);
  }, [products_sold]);

  const filteredProviders = useMemo(() => {
    const start = Date.now();
    const res = providers.filter((p) => productsByProvider?.get(p.code) ?? 0 > 0);
    console.log('filteredProviders elapsed', Date.now() - start);

    return res;
  }, [providers, productsByProvider]);

  const allProviersCodes = useMemo(() => {
    const start = Date.now();
    const res = new Set<string>(filteredProviders?.map((p) => p.code));
    console.log('allProviersCodes elapsed', Date.now() - start);
    return res;
  }, [filteredProviders]);

  const defaultValues = useMemo(() => {
    const start = Date.now();
    const res = Array.from(allProviersCodes ?? new Set<string>()).filter((code) => !providersSelected.has(code));
    console.log('defaultValues elapsed', Date.now() - start);
    return res;
  }, [allProviersCodes, providersSelected]);

  useEffect(() => {
    if (fromDate && toDate && !hasRun) {
      let start = Date.now();
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
      console.log('useEffect getConsumptionStats elapsed', Date.now() - start);
      start = Date.now();
      const tempSales = getSalesAndBudgets(
        fromDate ?? new Date("2023-09-04"),
        toDate ?? new Date("2024-09-04"),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      console.log('useEffect getSalesAndBudgets elapsed', Date.now() - start);
      start = Date.now();
      const tempSoldProportions = getSoldProportions(
        fromDate ?? new Date("2023-09-04"),
        toDate ?? new Date("2024-09-04"),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      console.log('useEffect getSoldProportions elapsed', Date.now() - start);
      start = Date.now();
      const tempGeneral = getGeneralStatistics(
        fromDate ?? new Date("2023-09-04"),
        toDate ?? new Date("2024-09-04"),
        Array.from(unselectedClients),
        Array.from(providersSelected),
        productCode,
      );
      console.log('useEffect getGeneralStatistics elapsed', Date.now() - start);
      start = Date.now();
      const tempCuts = getCuts(productCode, fromDate ?? new Date("2023-09-04"), toDate ?? new Date("2024-09-04"));
      console.log('useEffect getCuts elapsed', Date.now() - start);
      setConsumption(consumptionStats);
      setTotalConsumedAmount(totalTemp);
      setTotalMotiveConsumption(totalMotiveTemp);
      setSalesAndBudgets(tempSales);
      setSoldProportions(tempSoldProportions);
      setGeneralStatistics(tempGeneral);
      setCuts(tempCuts);
      setHasRun(true);
      setIsLoading(false);
    }
  }, [fromDate, toDate, defaultValues]);

  useEffect(() => {
    if (handleFiltersStage === 1) {
      // le doy tiempo a react para renderizar el loader antes de que se congele todo
      setTimeout(() => setHandleFiltersStage(2), 150);
    } else if (handleFiltersStage === 2) {
      handleUpdateFilters();
      setHandleFiltersStage(0);
    }
  }, [handleFiltersStage]);

  // necesita budgetsById, crm_clients y budget_products del monolito data
  const crmMonolito = {
    budget_products: budget_products,
    budgetsById: budgetsById,
    crm_clients: crm_clients
  };

  const product = products.find((p) => p.code === productCode) ?? null;

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
        setCuts(getCuts(productCode, fromDate, toDate));
        setIsLoading(false);
      } catch (e) {
        setIsLoading(false);
      }
    }
  }

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
    const totalMotiveConsumption = new Map<string, number>();
    const tupleToAmountMap = new Map<[string, string], number>();
    let totalConsumedAmount = 0;

    let events = eventsByProductCode?.[productCode] ?? [];
    events = events.filter(
      (event) => event.type != "import" && new Date(event.date) && new Date(event.date) >= fromDate && new Date(event.date) <= toDate,
    );
    events.forEach((event) => {
      const parentEvent = event.parentEventIndex !== undefined ? indexedEvents[event.parentEventIndex]! : undefined;
      const assembliesQuantities =
        parentEvent?.originalQuantity && parentEvent.originalQuantity - parentEvent.quantity;
      if (event.assemblyId) {
        const assembly = assemblyById[event.assemblyId];
        const totalConsumptionOnEvent = (assembly?.quantity ?? 0) * (assembliesQuantities ?? 1);
        totalConsumedAmount += totalConsumptionOnEvent;
        let day = "";
        if (new Date(event.date) instanceof Date && !isNaN(new Date(event.date).getTime())) {
          day = new Date(event.date).toISOString().slice(0, 10);
        }

        const key: [string, string] = [day, parentEvent?.productCode ?? ""];
        const currentAmount = tupleToAmountMap.get(key) ?? 0;
        tupleToAmountMap.set(key, currentAmount + totalConsumptionOnEvent);
        const currentMotiveAmount = totalMotiveConsumption.get(parentEvent?.productCode ?? "") ?? 0;
        totalMotiveConsumption.set(parentEvent?.productCode ?? "", currentMotiveAmount + totalConsumptionOnEvent);
      }
    });

    const salesList: {
      date: string;
      motive: string;
      amount: number;
    }[] = [];
    const sales = sold.filter(
      (order) =>
        !clientExemptionList?.includes(order.client_code) &&
        new Date(order.emission_date) >= fromDate &&
        new Date(order.emission_date) <= toDate,
    );
    sales.forEach((sale) => {
      const order_products = sale.products;
      const product = order_products?.find((order_product) => order_product.product_code === productCode);
      if (product) {
        salesList.push({
          date: new Date(sale.emission_date).toISOString().slice(0, 10),
          motive: "Venta Directa",
          amount: product.CANTIDAD,
        });
        const currentMotiveAmount = totalMotiveConsumption.get("Venta Directa") ?? 0;
        totalMotiveConsumption.set("Venta Directa", currentMotiveAmount + product.CANTIDAD);
        totalConsumedAmount += product.CANTIDAD;
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
    const salesMap = new Map<number, number>();
    const budgetsMap = new Map<number, number>();

    sold.forEach((sale) => {
      const emDate = new Date(sale?.emission_date);
      if (!(emDate instanceof Date) || isNaN(emDate.getTime()) || clientExemptionList?.includes(sale.client_code)) {
        return;
      }

      const isValidDate = fromDateCopy <= emDate && emDate <= toDate;
      if (!isValidDate) {
        return;
      }

      const order_products = sale.products;
      if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
        const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
        salesMap.set(emDate.getTime(), (salesMap.get(emDate.getTime()) ?? 0) + (order_product?.CANTIDAD ?? 0));
      }
    });

    budgets.forEach((budget) => {
      const bDate = budget.date ? new Date(budget.date) : null;
      if (!(bDate instanceof Date) || isNaN(bDate.getTime()) || clientExemptionList?.includes(budget.client_id)) {
        return;
      }

      const isValidDate = fromDateCopy <= bDate && bDate <= toDate;
      if (!isValidDate) {
        return;
      }


      const product = budget.products.find((product) => product.product_code === productCode);
      if (product) {
        budgetsMap.set(bDate.getTime(), (budgetsMap.get(bDate.getTime()) ?? 0) + product.quantity);
      }
    });

    const salesList = [...salesMap.entries()].sort().map(v => {
      return {
        date: (new Date(v[0])).toISOString().slice(0, 10),
        totalSales: v[1]
      }
    });

    const budgetsList = [...budgetsMap.entries()].sort().map(v => {
      return {
        date: (new Date(v[0])).toISOString().slice(0, 10),
        totalBudgets: v[1]
      }
    });

    return { salesList, budgetsList };
  }

  function getSoldProportions(
    fromDate: Date,
    toDate: Date,
    clientExemptionList: string[] | null,
    providerExemptionList: string[] | null,
    productCode: string,
  ) {
    const sales = sold.filter(
      (order) =>
        !clientExemptionList?.includes(order.client_code) &&
        new Date(order.emission_date) >= fromDate &&
        new Date(order.emission_date) <= toDate,
    );

    const clientInformation = new Map<string, [number, number]>();
    sales?.forEach((sale) => {
      const order_products = sale.products;
      if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
        const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
        const [totalSales, amountOfSalse] = clientInformation.get(sale.client_code) ?? [0, 0];
        clientInformation.set(sale.client_code, [totalSales + (order_product?.CANTIDAD ?? 0), amountOfSalse + 1]);
      }
    });

    const clientList = Array.from(clientInformation.entries()).map(([key, value]) => {
      const [totalSales, amountOfSales] = value;

      return {
        name: clients.find((client) => client.code === key)!.name,
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
    /* const sales = sold.filter(
      (order) =>
        !clientExemptionList?.includes(order.client_code) &&
        new Date(order.emission_date) >= fromDate &&
        new Date(order.emission_date) <= toDate,
    );

    const validOrderProducts: {
      sale?: (typeof sales)[0];
      product_code: string;
      ordered_quantity: number;
    }[] = [];

    sales?.forEach((sale) => {
      const order_products = sale.products;
      if ((order_products?.filter((order_product) => order_product.product_code === productCode)?.length ?? 0) > 0) {
        const order_product = order_products?.find((order_product) => order_product.product_code === productCode);
        if (order_product) {
          validOrderProducts.push({
            product_code: order_product.product_code,
            sale: sale,
            ordered_quantity: order_product.CANTIDAD,
          });
        }
      }
    });

    let events = eventsByProductCode?.[productCode] ?? [];
    events = events.filter(
      (event) => event.type != "import" && new Date(event.date) && new Date(event.date) >= fromDate && new Date(event.date) <= toDate,
    );

    events.forEach((event) => {
      // event.quantity
      if (event.assemblyId) {
        const parentEvent = event.parentEventIndex !== undefined ? indexedEvents[event.parentEventIndex]! : undefined;
        const assembliesQuantities =
          parentEvent?.originalQuantity && parentEvent.originalQuantity - parentEvent.quantity;
        const assembly = assemblyById[event.assemblyId];
        const totalConsumptionOnEvent = (assembly?.quantity ?? 0) * (assembliesQuantities ?? 1);
        let day = "";
        if (new Date(event.date) instanceof Date && !isNaN(new Date(event.date).getTime())) {
          day = new Date(event.date).toISOString().slice(0, 10);
        }
        validOrderProducts.push({
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
    }; */

    // salidas en x fechas
    // const allSales = productProductsSold.filter(v => v.t === 'S' && v.f >= fromDate.getTime() && v.f <= toDate.getTime());
    const allSales = productProductsSold
      .filter(v => v.date >= fromDate.getTime() && v.date <= toDate.getTime() && v.CANTIDAD > 0);
    //.map(v => v.t !== 'S' ? ({
    /* .map(v => v.CANTIDAD < 0 ? ({
      ...v,
      CANTIDAD: 0
    }) : v); */

    const sortedQuantities = allSales.map(v => v.CANTIDAD);
    sortedQuantities.sort((a, b) => a - b);

    const mid = Math.floor(sortedQuantities.length / 2);

    const maxSales = sortedQuantities.length > 0 ? Math.max(...sortedQuantities) : 0;
    const minSales = sortedQuantities.length > 0 ? Math.min(...sortedQuantities) : 0;
    const totalSaleCount = sortedQuantities.length;
    const totalSales = sortedQuantities.reduce((acc, val) => acc + val, 0);
    const avgSales = sortedQuantities.length > 0 ? (totalSales / sortedQuantities.length) : 0;
    const medianSales = (sortedQuantities.length % 2 === 0 ? ((
      (sortedQuantities[mid - 1] ?? 0) + (sortedQuantities[mid] ?? 0)
    ) / 2) : sortedQuantities[mid]) ?? 0;

    const res = {
      maxSales,
      minSales,
      avgSales,
      totalSales,
      totalSaleCount,
      medianSales
    };

    return res;
  }

  function getCuts(productCode: string, fromDate: Date, toDate: Date) {
    const prod = products.find((p) => p.code === productCode)!;
    const possibleSuppliesOf = (prod.suppliesOf ?? []).map(x => x.product_code);
    const mapeoConsumo = new Map<string, number>();

    possibleSuppliesOf?.map((supplyOfCode) => {
      const semielaborate = products.find((p) => p.code === supplyOfCode);
      const dataSemi = isSemiElaborate(semielaborate);

      // acá no filtramos por tipo de salida
      // figura todo lo que es armado y ventas
      if (dataSemi !== null) {
        const clave = dataSemi.long + " mm";
        const stockMovements = products_sold.filter(v =>
          v.product_code === supplyOfCode &&
          v.date >= fromDate.getTime() &&
          v.date <= toDate.getTime() &&
          // v.t === 'S' &&
          v.CANTIDAD > 0
        );

        for (const movement of stockMovements) {
          mapeoConsumo.set(clave, movement.CANTIDAD + (mapeoConsumo.get(clave) ?? 0));
        }
      }
    });

    return mapeoConsumo;
  }

  const toggleShowMore = () => {
    setShowMore((showMore) => !showMore);
  };

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
              options={filteredProviders?.map((p) => ({
                title: p.name,
                subtitle: p.code + " - " + (p.address || "") + " " + ` - Productos: ${productsByProvider?.get(p.code) ?? 0}`,
                value: p.code,
              })) ?? []}
              defaultValues={defaultValues ?? []}
              onApply={(selectedList) => {
                const selected = new Set(selectedList);
                const value = new Set<string>();
                for (const provider of filteredProviders ?? []) {
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
            <SelectCRMClients monolito={crmMonolito} setSelected={setSelected} unselected={unselectedClients} />
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
              options={filteredProviders?.map((p) => ({
                title: p.name,
                subtitle: p.code + " - " + (p.address || "") + " " + ` - Productos: ${productsByProvider?.get(p.code) ?? 0}`,
                value: p.code,
              })) ?? []}
              defaultValues={defaultValues ?? []}
              onApply={(selectedList) => {
                const selected = new Set(selectedList);
                const value = new Set<string>();
                for (const provider of filteredProviders ?? []) {
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
            <SelectCRMClients monolito={crmMonolito} setSelected={setSelected} unselected={unselectedClients} />
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
                    <p className="text-5xl font-bold text-black">{Math.round(generalStatistics?.totalSales ?? 0)}</p>
                    <p className="text-sm font-medium text-black mt-2">Ventas Totales</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ventas Totales: todas las veces que se vendió ese producto.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{generalStatistics?.totalSaleCount ?? 0}</p>
                    <p className="text-sm font-medium text-black mt-2">Cantidad de Pedidos</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cantidad de pedidos que incluye este elemento.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{Math.round(generalStatistics?.maxSales ?? 0)}</p>
                    <p className="text-sm font-medium text-black mt-2">Máximo UVP</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Máximas unidades vendidas por pedido.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{Math.round(generalStatistics?.minSales ?? 0)}</p>
                    <p className="text-sm font-medium text-black mt-2">Mínimo UVP</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mínimas unidades vendidas por pedido.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{Math.round(generalStatistics?.avgSales ?? 0)}</p>
                    <p className="text-sm font-medium text-black mt-2">UPP</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Unidades promedio por pedido.</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger className="text-center p-4 bg-[#f1f3f1d0] rounded-lg w-full h-full">
                    <p className="text-5xl font-bold text-black">{Math.round(generalStatistics?.medianSales ?? 0)}</p>
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
            <ClientUnitsSold data={soldProportions ?? []} />
          </div>
          <div className="flex flex-wrap gap-x-4 mb-12 w-max-[1077px]">
            <SimpleLineChart data={salesAndBudgets} />
            <SimpleBartChartRecuts data={cuts} />
          </div>
        </DataCard>
      </AppLayout >
    );
  }
}
