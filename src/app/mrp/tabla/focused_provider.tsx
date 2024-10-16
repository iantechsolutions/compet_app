"use client";
/* eslint-disable */

import { createContext, useContext, useState } from "react";
import { MonolitoProduct } from "~/server/api/routers/db";

export type FocusedContext = {
  product: MonolitoProduct;
  month?: string;
  elementId: string;
} | null;

const focusedContext = createContext<{
  focus: FocusedContext;
  setFocus: (focus: FocusedContext) => void;
}>({
  focus: null,
  setFocus: () => { },
});

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [currentFocus, setCurrentFocus] = useState<FocusedContext>(null);

  return (
    <focusedContext.Provider
      value={{
        focus: currentFocus,
        setFocus: setCurrentFocus,
      }}
    >
      {children}
    </focusedContext.Provider>
  );
}

export function useFocus() {
  const { focus, setFocus } = useContext(focusedContext);
  return [focus, setFocus] as const;
}
