"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Ban, Settings2Icon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { ComboboxDemo } from "~/components/combobox";
import ListSelectionDialog from "~/components/list-selection-dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { useShortcut } from "~/lib/hooks";
import type { RouterOutputs } from "~/trpc/shared";

export type Filters = {
  search: string;
  hideAllZero: boolean;
  hideProviders: Set<string>;
  suppliesOf?: string;
};

export function FiltersDialog(props: {
  initialFilters: Filters;
  onApply: (filters: Filters) => void;
  number: number;
  monolito: RouterOutputs['db']['getMonolito'],
}) {
  const data = props.monolito.data;
  const products = data.products!;
  const [filters, setFilters] = useState<Filters>(props.initialFilters);

  const closeId = useId();

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFilters({
      ...filters,
      search: event.target.value,
    });
  }

  function handleSuppliesOfChange(value: string | undefined) {
    setFilters({
      ...filters,
      suppliesOf: value?.trim(),
    });
  }

  function setHideAllZero(value: boolean) {
    setFilters({
      ...filters,
      hideAllZero: value,
    });
  }

  function setHideProviders(providers: Set<string>) {
    setFilters({
      ...filters,
      hideProviders: providers,
    });
  }

  function handleApply() {
    props.onApply(filters);
  }

  useShortcut("b", () => {
    document.getElementById("filters-trigger-btn")?.click();
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" id="filters-trigger-btn">
          <Settings2Icon className="mr-2" size={20} />
          Filtros
          <aside className="ml-2 rounded-full bg-stone-200 px-2 py-1 text-sm" aria-label="Cantidad de productos mostrados:">
            {props.number}
          </aside>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[425px]"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleApply();
            document.getElementById(closeId)?.click();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>Elegir que información mostrar</DialogDescription>
        </DialogHeader>
        <Input id="search" placeholder="Buscar..." className="w-full" value={filters.search} onChange={handleSearchChange} />
        {/* <Input id='supplies_of_code' placeholder='Código de producto' className='w-full' value={filters.suppliesOf || ''} onChange={handleSuppliesOfChange} /> */}
        <div className="flex flex-row items-center gap-5">
          <ComboboxDemo
            title="Codigo de producto"
            placeholder="Seleccione un producto finalizado por el que buscar"
            value={filters.suppliesOf ?? ""}
            onSelectionChange={(value) => {
              handleSuppliesOfChange(value);
            }}
            options={products
              .filter((x) => x.supplies && x.supplies.length > 0)
              .map((product) => ({
                value: product.code,
                label: product.code,
              }))}
          ></ComboboxDemo>
          <Button
            variant={"ghost"}
            // className='h-5 w-5'
            onClick={() => handleSuppliesOfChange(undefined)}
          >
            <Ban height={20} width={20} />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" checked={filters.hideAllZero} onCheckedChange={setHideAllZero} />
          <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Ocultar productos sin importaciones ni ordenes
          </label>
        </div>

        <ProvidersFilter onChange={setHideProviders} value={filters.hideProviders} monolito={props.monolito} />

        <DialogFooter>
          <DialogPrimitive.Close id={closeId} asChild>
            <Button type="submit" onClick={handleApply}>
              Aplicar
            </Button>
          </DialogPrimitive.Close>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderRow(props: {
  index: number;
  style: React.CSSProperties;
  value: Set<string>;
  onChange: (providers: Set<string>) => void;
  monolito: RouterOutputs['db']['getMonolito'];
}) {
  const providers = props.monolito.data.providers!;
  const provider = providers[props.index]!;

  const labelId = "label-" + provider.code;

  return (
    <div className="flex h-[40px] items-center space-x-2" style={props.style}>
      <Checkbox
        id={provider.code}
        tabIndex={-1}
        checked={!props.value.has(provider.code)}
        onCheckedChange={(value) => {
          if (value) {
            props.value.delete(provider.code);
          } else {
            props.value.add(provider.code);
          }
          props.onChange(new Set(props.value));
        }}
      />
      <label
        id={labelId}
        tabIndex={0}
        htmlFor={provider.code}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById(provider.code)?.click();
            setTimeout(() => {
              document.getElementById(labelId)?.focus();
            }, 100);
          }
        }}
      >
        {provider.name}
      </label>
    </div>
  );
}

function ProvidersFilter(props: {
  value: Set<string>;
  onChange: (providers: Set<string>) => void;
  monolito: RouterOutputs['db']['getMonolito'];
}) {
  const data = props.monolito.data;
  const providers = data.providers!;
  const products = data.products!;

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
  }, [providers, props.value]);

  const allProviersCodes = useMemo(() => {
    return new Set<string>(filteredProviders.map((p) => p.code));
  }, [providers]);

  const defaultValues = useMemo(() => {
    return Array.from(allProviersCodes).filter((code) => !props.value.has(code));
  }, [allProviersCodes, props.value]);

  return (
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
        props.onChange(value);
      }}
    >
      <Button variant="outline">Ocultar o mostrar proveedores</Button>
    </ListSelectionDialog>
  );
}

// function ProvidersFilter(props: {
//     value: Set<string>,
//     onChange: (providers: Set<string>) => void
// }) {
//     const providers = useMRPData().providers

//     const [hideProviders, setHideProviders] = useState(props.value)

//     const closeId = useId()

//     function handleApply() {
//         props.onChange(hideProviders)
//     }

//     const [search, setSearch] = useState("")

//     const filteredProviders = useMemo(() => {
//         return providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
//     }, [providers, search])

//     const size = useWindowSize()

//     return (
//         <Dialog>
//             <DialogTrigger asChild>
//                 <Button variant="outline">Ocultar o mostrar proveedores</Button>
//             </DialogTrigger>
//             <DialogContent className="sm:max-w-[425px]"
//                 onKeyDown={(e) => {
//                     if (e.key === 'Enter') {
//                         handleApply()
//                         document.getElementById(closeId)?.click()
//                         e.stopPropagation()
//                     }
//                 }}
//             >
//                 <DialogHeader>
//                     <DialogTitle>Proveedores</DialogTitle>
//                     <DialogDescription>
//                         Mostrar u ocultar proveedores
//                     </DialogDescription>
//                 </DialogHeader>
//                 <Input
//                     id="search_providers"
//                     placeholder="Buscar..."
//                     className="w-full"
//                     value={search}
//                     onChange={(e) => setSearch(e.target.value)}
//                 />
//                 <div className="grid gap-5 grid-cols-2">
//                     <Button variant="outline"
//                         onClick={() => {
//                             setHideProviders(new Set(providers.map(p => p.code)))
//                         }}
//                     >Ninguno</Button>
//                     <Button variant="outline"
//                         onClick={() => {
//                             setHideProviders(new Set())
//                         }}
//                     >Todos</Button>
//                 </div>
//                 <div className="max-h-[calc(100vh_-_296px)] overflow-y-auto">
//                     <List
//                         height={(size.height ?? window.innerHeight) - 296}
//                         itemCount={filteredProviders.length}
//                         itemSize={40}
//                         width="100%"
//                     >
//                         {({ index, style }) => (
//                             <ProviderRow
//                                 index={index}
//                                 style={style}
//                                 value={hideProviders}
//                                 onChange={setHideProviders}
//                             />
//                         )}
//                     </List>
//                 </div>

//                 <DialogFooter>
//                     <DialogPrimitive.Close
//                         id={closeId}
//                         asChild
//                     >
//                         <Button type="submit" onClick={handleApply}>Aplicar</Button>
//                     </DialogPrimitive.Close>
//                 </DialogFooter>
//             </DialogContent>
//         </Dialog>
//     )
// }
