import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { CutUnits } from "~/lib/types";
import type { ProductWithDependencies, ProductWithDependenciesCut } from "~/server/api/routers/consult";

const CutCardContent = (props: { cut: ProductWithDependenciesCut }) => {
  const v = props.cut;
  return <div className="flex flex-col text-sm text-muted-foreground">
    <p>Lote: {(v.cut.lote?.length ?? 0) === 0 ? '-' : v.cut.lote}</p>
    <p>Caja: {(v.cut.caja?.length ?? 0) === 0 ? '-' : v.cut.caja}</p>
    <p>Ubicación: {(v.cut.location?.length ?? 0) === 0 ? '-' : v.cut.location}</p>
    <p>Cantidad: {v.cut.amount}</p>
    <p>Medida: {v.cut.units as CutUnits === CutUnits.Meters ? (v.cut.measure / 1000) : v.cut.measure} {v.cut.units}</p>
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

  const cutsEntries = [...cutsMapped.entries()];
  const cutsEntry = cutsEntries[0]!

  if (cutsEntries.length > 1) {
    console.error(`cutsEntries.length > 1`, cutsEntries);
  }

  return <Dialog>
    <DialogTrigger asChild>{props.children}</DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          <div className="flex flex-col">
            <p>Recortes a usar ({props.product.productCode})</p>
            <p className="font-semibold text-xs">{props.product.description}</p>
          </div>
        </DialogTitle>
        <DialogDescription>
          {cutsEntry[1].map(v => <Card className="my-2">
            <CardContent className="flex flex-auto my-4">
              <CutCardContent cut={v} />
            </CardContent>
          </Card>)}
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog >
}