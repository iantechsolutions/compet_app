import { CheckCheckIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, XSquareIcon } from "lucide-react";
import { createContext, useMemo, useState, useContext } from "react";
import { FixedSizeList as List } from "react-window";
import { Button } from "~/components/ui/button";
import { Input } from "./ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

export type ListSelectionDialogProps = {
  children: React.ReactNode;
  title: React.ReactNode;
  options: {
    title: React.ReactNode;
    subtitle: React.ReactNode;
    value: string;
  }[];
  onApply: (selected: string[]) => void;
  defaultValues?: Iterable<string>;
  onCanceled?: () => void;
  height?: number;
  readOnly?: boolean;
};

const MyComponent = (props: any) => {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);}

const rowsContext = createContext<{
  options: ListSelectionDialogProps["options"];
  selected: Set<string>;
  onClickOption: (option: string) => void;
}>(null!);

export default function ListSelectionDialog(props: ListSelectionDialogProps) {
  const [selected, setSelected] = useState(new Set(props.defaultValues ?? []));
  const allValuesList = useMemo(() => props.options.map((o) => o.value), [props.options]);
  const [filter, setFilter] = useState("");
  

  const filteredOptions = useMemo(() => {
    if (!filter.trim()) return props.options;
    return props.options.filter((o) => {
      if (o.title?.toString().toLowerCase().includes(filter.toLowerCase())) return true;
      if (o.subtitle?.toString().toLowerCase().includes(filter.toLowerCase())) return true;
      if (o.value?.toString().toLowerCase().includes(filter.toLowerCase())) return true;
      return false;
    });
  }, [props.options, filter]);

  const MyComponent = (props: any) => {
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    return (
      <Accordion type="single" collapsible>
      <AccordionItem
        value="providers"
        onClick={() => setIsAccordionOpen(!isAccordionOpen)} // Actualizar el estado al hacer clic
      >
        <AccordionTrigger>
          <div className="flex items-center p-2 border border-purple-500 rounded-md w-full">
            <span className="text-purple-700 font-semibold">Proveedores</span>
            {isAccordionOpen ? (
              <ChevronUpIcon className="ml-2 text-purple-500" />
            ) : (
              <ChevronDownIcon className="ml-2 text-purple-500" />
            )}
          </div>
        </AccordionTrigger>
    
        <AccordionContent>
          <div className="p-4">
            <h3 className="text-lg font-semibold text-purple-700">{props.title}</h3>
    
            {/* Campo de búsqueda */}
            <Input
              name="search"
              placeholder="Buscar"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="my-2 border border-gray-300"
            />
    
            {/* Lista de selección */}
            <rowsContext.Provider
              value={{
                options: filteredOptions,
                selected,
                onClickOption: (option) => {
                  if (props.readOnly) return;
                  if (selected.has(option)) {
                    selected.delete(option);
                  } else {
                    selected.add(option);
                  }
                  setSelected(new Set(selected));
                },
              }}
            >
              <ListRender />
            </rowsContext.Provider>
    
            {/* Botones de acción */}
            {!props.readOnly && (
              <div className="flex w-full items-center gap-2 mt-4">
                <Button variant="ghost" onClick={() => setSelected(new Set(allValuesList))}>
                  <CheckCheckIcon />
                </Button>
                <Button variant="ghost" onClick={() => setSelected(new Set())}>
                  <XSquareIcon />
                </Button>
                <Button className="ml-auto bg-purple-500 text-white hover:bg-purple-600" onClick={() => props.onApply(Array.from(selected))}>
                  Aceptar
                </Button>
              </div>
            )}
            {props.readOnly && (
              <div className="flex w-full justify-center mt-4">
                <Button onClick={props.onCanceled}>Cerrar</Button>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
    
    );
  };
function ListRender() {
  const ctx = useContext(rowsContext);
  const options = ctx.options;

  return (
    <List height={300} itemCount={options.length} itemSize={70} width={"100%"}>
      {Row}
    </List>
  );
}

function Row({ index, style }: { index: number; style: React.CSSProperties }) {
  const ctx = useContext(rowsContext);
  const options = ctx.options;
  const option = options[index];

  if (!option) return null;

  return (
    <button
      style={style}
      className="flex h-[70px] items-center px-2 text-left outline-none focus:bg-stone-200"
      onClick={() => ctx.onClickOption(option.value)}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          ((e.target as HTMLElement).nextElementSibling as HTMLElement | undefined)?.focus();
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          ((e.target as HTMLElement).previousElementSibling as HTMLElement | undefined)?.focus();
        }
      }}
    >
      <div>
        <p className="font-medium">{option.title}</p>
        {option.subtitle && <p className="text-xs">{option.subtitle}</p>}
      </div>
      {ctx.selected.has(option.value) && <CheckIcon className="ml-auto mr-2" />}
    </button>
  );
};
}
