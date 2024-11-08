import dayjs from "dayjs";
import { Card, CardContent, } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { getCutVisualMeasure } from "~/lib/utils";
import type { ProductWithDependencies, ProductWithDependenciesCut } from "~/server/api/routers/consult";

const CutCardContent = (props: { cut: ProductWithDependenciesCut }) => {
  const v = props.cut;
  return <div className="flex flex-col text-sm text-muted-foreground">
    <p>Lote: {(v.cut.lote?.length ?? 0) === 0 ? '-' : v.cut.lote}</p>
    <p>Caja: {(v.cut.caja?.length ?? 0) === 0 ? '-' : v.cut.caja}</p>
    <p>Ubicación: {(v.cut.location?.length ?? 0) === 0 ? '-' : v.cut.location}</p>
    <p>Cantidad: {v.cut.amount}</p>
    <p>Medida: {getCutVisualMeasure(v.cut.measure, v.cut.units)} {v.cut.units}</p>
    <p>Consumido: {v.amount}</p>
  </div>;
}

export const ConsultCutsDialog = (props: { product: ProductWithDependencies, cuts: ProductWithDependenciesCut[], children: React.ReactNode }) => {
  const cuts = props.cuts;
  // const cuts = [...props.cuts, ...props.cuts];
  const cutsMapped: Map<string, ProductWithDependenciesCut[]> = new Map<string, ProductWithDependenciesCut[]>();
  for (const cut of cuts) {
    if (cutsMapped.has(cut.cut.prodId)) {
      cutsMapped.get(cut.cut.prodId)!.push(cut);
    } else {
      cutsMapped.set(cut.cut.prodId, [cut]);
    }
  }

  let errorMessage: string | null = null;
  let importData: {
    date: Date,
    code: string,
  } | null = null;

  if (props.product.state !== 'preparable') {
    if (props.product.dependencies?.length !== 1) {
      console.error('ConsultCutsDialog dependencies.length !== 1');
    } else {
      const dep = props.product.dependencies[0]!;
      if (dep.state === 'sinEntrada') {
        errorMessage = "No alcanzan los recortes, no hay entrada.";
      } else if (dep.state === 'import') {
        errorMessage = "No alcanzan los recortes.";
        importData = {
          code: dep.arrivalData!.importId.slice(-4),
          date: dep.arrivalData!.date,
        }
      }
    }
  }

  if (errorMessage !== null) {
    return <Dialog>
      <DialogTrigger asChild>{props.children}</DialogTrigger>
      <DialogContent className="min-w-[580px]">
        <DialogHeader>
          <DialogTitle>
            <div className="flex flex-col">
              <p>No alcanzan los recortes</p>
              <p className="font-semibold text-xs">{props.product.description}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            <p className="text-red-600">{errorMessage}</p>
            {importData !== null ? <>
              <p>Fecha de entrada: {dayjs(importData.date.toString()).format("YYYY-MM")}</p>
              <p>Código de importación: {importData.code}</p>
            </> : <></>}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog >;
  } else if (props.cuts.length === 0) {
    return <></>;
  }

  const cutsEntries = [...cutsMapped.entries()];
  const cutsEntry = cutsEntries[0]!;

  if (cutsEntries.length > 1) {
    console.error(`cutsEntries.length > 1`, cutsEntries);
  }

  let description;
  if (cutsEntry[1].length > 10) {
    description = <div className="grid-cols-3 grid gap-x-3">
      {cutsEntry[1].map(v => <Card className="my-2">
        <CardContent className="flex flex-auto my-4">
          <CutCardContent cut={v} />
        </CardContent>
      </Card>)}
    </div>;
  } else if (cutsEntry[1].length > 5) {
    description = <div className="grid-cols-2 grid gap-x-3">
      {cutsEntry[1].map(v => <Card className="my-2">
        <CardContent className="flex flex-auto my-4">
          <CutCardContent cut={v} />
        </CardContent>
      </Card>)}
    </div>;
  } else {
    description = cutsEntry[1].map(v => <Card className="my-2">
      <CardContent className="flex flex-auto my-4">
        <CutCardContent cut={v} />
      </CardContent>
    </Card>);
  }

  return <Dialog>
    <DialogTrigger asChild>{props.children}</DialogTrigger>
    <DialogContent className="min-w-[580px]">
      <DialogHeader>
        <DialogTitle>
          <div className="flex flex-col">
            <p>Recortes a usar ({props.product.productCode})</p>
            <p className="font-semibold text-xs">{props.product.description}</p>
          </div>
        </DialogTitle>
        <DialogDescription>
          {description}
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog >
}