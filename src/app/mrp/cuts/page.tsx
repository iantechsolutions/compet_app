import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { ListRowContainer } from "../consulta/consultPage";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/server";
export default async function Page() {
    const cuts = await api.cuts.list.query();
    const prodIdSet = new Set<string>()
    //obtengo todos los prodId sin repetir
    cuts.forEach((cut) => prodIdSet.add(cut.prodId))
    //obtengo todos las longitudes de recortes sin repetir 
    const cutsLengthSet = new Set<string>()
    cuts.forEach((cut) => cutsLengthSet.add(cut.measure.toString()))


    // creo un Map con los prodId y la cantidad de recortes por longitud
    const cutsMap = new Map<string, Map<string, number>>()
    for (const cut of cuts) {
        if (!cutsMap.has(cut.prodId)) {
            cutsMap.set(cut.prodId, new Map<string, number>())
        }
        const prodMap = cutsMap.get(cut.prodId)
        if (prodMap && !(prodMap.has(cut.measure.toString()))) {
            prodMap.set(cut.measure.toString(), cut.amount)
        } else if (prodMap && prodMap.has(cut.measure.toString())) {
            const currentAmount = prodMap.get(cut.measure.toString()) ?? 0;
            prodMap.set(cut.measure.toString(), currentAmount + cut.amount);
        }
    }

    for (const prodMap of cutsMap) {
        for (const cutLength of cutsLengthSet) {
            if (!prodMap[1].has(cutLength)) {
                prodMap[1].set(cutLength, 0)
            }
        }
    }

    const headerCellClassName = "flex items-center justify-center font-semibold bg-stone-100 h-10 px-2";

    return (
        <AppLayout title={<h1>Tabla Recortes</h1>} sidenav={<AppSidenav />}>
            {cuts.length === 0 && <h2 className="font-semibold">No hay recortes para mostrar</h2>}
            {cuts.length != 0 &&
                (
                    <>
                        <ListRowContainer style={{ overflowX: "hidden" }} className="z-10 shadow-md grid grid-cols-5">
                            <div className={cn(headerCellClassName, "flex md:left-0")}>
                                <p>Codigo Producto</p>
                            </div>
                            {Array.from(cutsLengthSet).map((cutLength) => (
                                <div key={cutLength} className={cn(headerCellClassName, "flex md:left-0")}>
                                    <p>Longitud: {cutLength}</p>
                                </div>
                            ))}
                        </ListRowContainer>
                        {Array.from(cutsMap).map(([prodId, prodMap]) => (
                            <ListRowContainer key={prodId} style={{ overflowX: "hidden" }} className="z-10 shadow-md grid grid-cols-5">
                                <div className={cn(headerCellClassName, "flex md:left-0")}>
                                    <p>{prodId}</p>
                                </div>
                                {Array.from(cutsLengthSet).map((cutLength) => (
                                    <div key={cutLength} className={cn(headerCellClassName, "flex md:left-0")}>
                                        <p>{prodMap.get(cutLength) ?? "-"}</p>
                                    </div>
                                ))}
                            </ListRowContainer>
                        ))}
                    </>
                )}
        </AppLayout>
    )
}

