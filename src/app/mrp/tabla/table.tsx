"use client";

/* eslint-disable */

import { useWindowSize } from "@uidotdev/usehooks";
import { useQueryState } from "next-usequerystate";
import { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useState } from "react";
import { FixedSizeList as List, type ListOnScrollProps } from "react-window";
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import type { NavUserData } from "~/components/nav-user-section";
import { useOnScroll } from "~/lib/hooks";
import { cn, formatStock } from "~/lib/utils";
import { type Filters, FiltersDialog } from "./filters_dialog";
import { useFocus } from "./focused_provider";
import { TargetOverlayInfoCard } from "./overlay";
import { api } from "~/trpc/react";
import { RouterOutputs } from "~/trpc/shared";
import { Button } from "~/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { MonolitoProduct } from "~/server/api/routers/db";

function ProductInfoCell({ product }: { product: MonolitoProduct }) {
  const [currentFocus, setFocus] = useFocus();
  const id = `product-info-cell-${product.code}`;

  const isFocused = currentFocus?.product.code === product.code;

  return (
    <button
      className={cn("z-10 grid grid-cols-[240px_130px] overflow-hidden border-b border-r bg-white md:sticky md:left-0", {
        "boder-blue-500 bg-blue-500 text-white": isFocused,
      })}
      onClick={() => setFocus({ product, month: undefined, elementId: id })}
      id={id}
    >
      <div className="m-0 border-r px-2 py-2 text-left shadow-sm">
        <p className="text-md font-medium">{product.code}</p>
        <p className="whitespace-nowrap text-xs font-semibold">{product.description}</p>
      </div>
      <div className="m-0 flex h-full items-center px-2 py-2">{product.additional_description}</div>
    </button>
  );
}

const cellCenterBaseStyles = "border-b border-r flex items-center w-full justify-center";

function StockCommitedCells({ product }: { product: MonolitoProduct }) {
  const [currentFocus, setFocus] = useFocus();

  const idStock = `stock-cell-${product.code}`;
  const idCommited = `commited-cell-${product.code}`;

  const stockIsFocused =
    currentFocus?.product.code === product.code && currentFocus?.month === undefined && currentFocus?.elementId === idStock;
  const commitedIsFocused =
    currentFocus?.product.code === product.code && currentFocus?.month === undefined && currentFocus?.elementId === idCommited;

  return (
    <>
      <button
        className={cn(cellCenterBaseStyles, {
          "bg-blue-500 text-white": stockIsFocused,
        })}
        onClick={() => setFocus({ product, month: undefined, elementId: idStock })}
        id={idStock}
      >
        {formatStock(product.stock)}
      </button>
      <button
        className={cn(cellCenterBaseStyles, {
          "bg-blue-500 text-white": commitedIsFocused,
        })}
        onClick={() => setFocus({ product, month: undefined, elementId: idCommited })}
        id={idCommited}
      >
        {formatStock(product.commited)}
      </button>
    </>
  );
}

function StockAtMonthCell({ product, month }: { product: MonolitoProduct; month: string }) {
  const stock = product.stock_at.get(month) ?? 0;

  const [currentFocus, setFocus] = useFocus();

  const id = `stock-at-month-cell-${product.code}-${month}`;

  return (
    <button
      key={month}
      id={id}
      onClick={() => setFocus({ product, month, elementId: id })}
      className={cn(cellCenterBaseStyles, "relative top-0 px-1 text-sm", {
        "bg-red-200 dark:bg-red-800": stock < 0,
        "text-stone-500": stock == 0,
        "outline-dashed outline-2 outline-blue-500": currentFocus?.product.code === product.code && currentFocus?.month === month,
      })}
    >
      {formatStock(stock)}

      <div className="absolute bottom-1 left-1 flex gap-1">
        {product.imported_quantity_by_month.get(month)! > 0 && <div className="h-[4px] w-[16px] rounded-full bg-green-600"></div>}
        {product.ordered_quantity_by_month.get(month)! > 0 && <div className="h-[4px] w-[16px] rounded-full bg-blue-600"></div>}
        {product.used_as_supply_quantity_by_month.get(month)! > 0 && (
          <div className="h-[4px] w-[16px] rounded-full bg-black dark:bg-white"></div>
        )}
        {Math.floor(product.used_as_forecast_quantity_by_month.get(month)!) > 0 && (
          <div className="h-[4px] w-[16px] rounded-full bg-orange-900 opacity-25"></div>
        )}
      </div>
    </button>
  );
}

function ListRowContainer({
  children,
  style,
  id,
  className,
  months,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  id?: string;
  months: string[];
}) {
  return (
    <div
      className={className}
      id={id}
      style={{
        ...style,
        display: "grid",
        gridTemplateColumns: `371px repeat(${months.length + 2}, minmax(130px, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

function ListRow({ index, style }: { index: number; style: React.CSSProperties }) {
  const ctx = useContext(listRowContext);
  const products = ctx.filteredProducts;
  const months = ctx.months;
  const product = products[index]!;

  return (
    <ListRowContainer
      key={index}
      months={months}
      style={{
        ...style,
        width: "", // para que el sticky funcione
      }}
    >
      <ProductInfoCell product={product} />
      <StockCommitedCells product={product} />
      {months.map((month) => (
        <StockAtMonthCell key={month} product={product} month={month} />
      ))}
    </ListRowContainer>
  );
}

const listRowContext = createContext<{
  filteredProducts: NonNullable<RouterOutputs['db']['getMonolito']['data']['products']>;
  months: string[];
}>({
  filteredProducts: [],
  months: [],
});

export function Table(props: { user?: NavUserData }) {
  const { data: months, isLoading: isLoadingMonths } = api.db.getMonths.useQuery();
  const { data: providers, isLoading: isLoadingProv } = api.db.getMProviders.useQuery();
  const { data: products, isLoading: isLoadingProds } = api.db.getMProductsWSupplies.useQuery();
  const { data: productsByCode, isLoading: isLoadingProdCodes } = api.db.getMProductsByCode.useQuery();
  const { data: forecastProfile, isLoading: isLoadingForeProf } = api.db.getForecastProfile.useQuery();
  const isLoadingData = isLoadingProv || isLoadingProds || isLoadingProdCodes || isLoadingForeProf || isLoadingMonths;

  const [filters, setFilters] = useFilters();

  const filtered = useMemo(() => {
    if (isLoadingData) {
      return null;
    }

    let list = products!;
    if (filters.hideAllZero) {
      list = list.filter((product) => {
        if (product.stock != 0) return true;

        for (const m of months!) {
          const stock = product.stock_at.get(m);
          if (stock != 0) return true;
        }

        return false;
      });
    }
    if (filters.search) {
      list = list.filter((product) => {
        return (
          product.code.toLowerCase().includes(filters.search.trim().toLowerCase()) ||
          product.description.toLowerCase().includes(filters.search.trim().toLowerCase())
        );
      });
    }
    if (filters.hideProviders.size > 0 && !(filters.hideProviders.has("") && filters.hideProviders.size == 1)) {
      list = list.filter((product) => {
        for (const provider of product.providers) {
          if (!filters.hideProviders.has(provider.provider_code)) {
            return true;
          }
        }

        return false;
      });
    }
    if (filters.suppliesOf) {
      const product = productsByCode!.get(filters.suppliesOf);
      if (!product) {
        return [];
      }
      let supplies = product.supplies?.map((p) => p.supply_product_code) ?? [];
      let index = 0;

      while (index < supplies.length) {
        const prod = productsByCode!.get(supplies[index] ?? "");
        console.log(prod);
        if (prod?.supplies) {
          supplies = supplies.concat(prod.supplies.map((p) => p.supply_product_code));
        }
        index += 1;
      }
      const productsIds = new Set(supplies);

      list = list.filter((product) => {
        return productsIds.has(product.code);
      });
    }
    return list;
  }, [isLoadingData, filters]);

  const size = useWindowSize();

  const h = (size.height ?? 1000) - 110;
  const w = size.width ?? window.innerWidth;

  const headerId = useId();
  const scrollClassName = "scroll-list-div";

  const scrolldivElement = document.getElementsByClassName(scrollClassName)[0] as HTMLElement | undefined;

  useOnScroll(scrolldivElement, (scrollX, scrollY) => {
    const headerElement = document.getElementById(headerId);
    if (!headerElement) return;

    headerElement.scrollTo(scrollX, 0);
  });

  const headerCellClassName = "flex items-center justify-center font-semibold bg-stone-100 h-10 px-2";

  const [currentFocus, _] = useFocus();

  const [closedOverlay, setClosedOverlay] = useState(false);

  useEffect(() => {
    if (currentFocus) {
      setClosedOverlay(false);
    }
  }, [currentFocus]);

  function handleListScroll(e: ListOnScrollProps) {
    if (e.scrollOffset === 0) {
      // This events fires before the layout effect, for this reason we need to delay the effect
      (window as any).listScrollTimeout = setTimeout(() => ((window as any).listScroll = e.scrollOffset), 500);
    } else {
      (window as any).listScroll = e.scrollOffset;
      clearTimeout((window as any).listScrollTimeout);
    }
  }

  useLayoutEffect(() => {
    document.getElementsByClassName(scrollClassName)[0]?.scrollTo(0, (window as any).listScroll);
  }, []);

  if (isLoadingData || !filtered) {
    return (
      <div className="fixed bottom-0 left-0 right-0 top-0 flex items-center justify-center">
        <Button variant="secondary" disabled>
          <Loader2Icon className="mr-2 animate-spin" /> Cargando datos...
        </Button>
      </div>
    );
  }

  return (
    <AppLayout
      title={<h1>COMPET MRP</h1>}
      user={props.user}
      sidenav={<AppSidenav />}
      hideMenuOnDesktop
      noPadding
      noUserSection
      actions={<FiltersDialog products={products!} providers={providers!} onApply={(f) => setFilters({ ...f })} initialFilters={filters} number={filtered.length} />}
    >
      {currentFocus && !closedOverlay && (
        <TargetOverlayInfoCard
          trackElementId={currentFocus.elementId!}
          column={currentFocus.month}
          product={currentFocus.product}
          productHref={`/mrp/productos/${encodeURIComponent(currentFocus.product.code)}`}
          forecastProfile={forecastProfile!}
          onClose={() => {
            setClosedOverlay(true);
          }}
        />
      )}

      <ListRowContainer id={headerId} months={months!} style={{ overflowX: "hidden" }} className="z-10 shadow-md">
        <div className={cn(headerCellClassName, "flex justify-start md:sticky md:left-0")}>
          <p>Producto</p>
        </div>
        <div className={cn(headerCellClassName, "text-sm")}>
          <p>Stock</p>
        </div>
        <div className={cn(headerCellClassName, "text-sm")}>
          <p>Comprometido</p>
        </div>
        {months!.map((month) => (
          <div key={month} className={cn(headerCellClassName, "text-sm")}>
            <p>{month}</p>
          </div>
        ))}
      </ListRowContainer>
      <div className="" style={{ height: h, width: w }}>
        <listRowContext.Provider value={{ filteredProducts: filtered, months: months! }}>
          <List onScroll={handleListScroll} className={scrollClassName} height={h} width={w} itemCount={filtered.length} itemSize={57}>
            {ListRow}
          </List>
        </listRowContext.Provider>
      </div>
    </AppLayout>
  );
}

function useFilters() {
  const [filtersHideAllZero, setName] = useQueryState("hide_zero", {
    clearOnDefault: true,
    defaultValue: true,
    parse: (v) => v === "true",
  });

  const [filtersSearch, setSearch] = useQueryState("search", {
    clearOnDefault: true,
    defaultValue: "",
  });

  const [filtersHideProviders, setProviders] = useQueryState("hide-providers", {
    clearOnDefault: true,
    defaultValue: new Set<string>(),
    parse: (v) => new Set(v.split(",")),
    serialize: (v) => Array.from(v).join(","),
  });

  const [suppliesOf, setSuppliesOf] = useQueryState("supplies-of", {
    defaultValue: "",
    clearOnDefault: true,
  });

  const filters = {
    hideAllZero: filtersHideAllZero,
    hideProviders: filtersHideProviders,
    search: filtersSearch,
    suppliesOf: suppliesOf.trim() || undefined,
  };

  function setFilters(f: Filters) {
    if (f.hideAllZero !== filters.hideAllZero) {
      setName(f.hideAllZero);
    }

    if (f.hideProviders !== filters.hideProviders) {
      setProviders(f.hideProviders);
    }

    if (f.search !== filters.search) {
      setSearch(f.search);
    }

    if (f.suppliesOf !== suppliesOf) {
      setSuppliesOf(f.suppliesOf || "");
    }
  }

  return [filters, setFilters] as const;
}
