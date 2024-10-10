"use client";
import { createContext, useContext } from "react";
import type { RouterOutputs } from "~/trpc/shared";

const productContext = createContext<RouterOutputs['db']['getProductByCode'] | null>(null);

export function ProductProvider(props: { children: React.ReactNode; product: RouterOutputs['db']['getProductByCode'] }) {
  return <productContext.Provider value={props.product}>{props.children}</productContext.Provider>;
}

export function useCurrentProduct() {
  const p = useContext(productContext);
  if (!p) throw new Error("No product found");
  return p;
}
