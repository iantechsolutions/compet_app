import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import type { RouterOutputs } from "~/trpc/shared";
import type { Monolito } from "~/server/api/routers/db";
import CutsTableElement from "./cuts-table-element";
import { getCutVisualMeasure } from "~/lib/utils";

interface Props {
  cuts: NonNullable<RouterOutputs['cuts']['list']>;
  productsByCode: Monolito['productsByCode'],
}

export type CutsSortType = 'cod' | 'desc' | 'lote' | 'caja' | 'ubic' | 'cant' | 'med' | 'un';
export type CutsSortDir = 'asc' | 'desc';

export default function CutsTable({ cuts, productsByCode }: Props) {
  const [sortType, setSortType] = useState<CutsSortType>('lote');
  const [sortDir, setSortDir] = useState<CutsSortDir>('asc');
  const [cutsMap, setCutsMap] = useState<Map<string, {
    measuresMap: Map<string, number>,
    cuts: NonNullable<RouterOutputs['cuts']['list']>[number][],
  }>>(new Map());

  useEffect(() => {
    const map = new Map<string, {
      measuresMap: Map<string, number>,
      cuts: NonNullable<RouterOutputs['cuts']['list']>[number][],
    }>();

    for (const cut of cuts) {
      if (!map.has(cut.prodId)) {
        map.set(cut.prodId, {
          measuresMap: new Map(),
          cuts: [],
        });
      }

      const prodMap = map.get(cut.prodId)!;
      const measuresMap = prodMap.measuresMap;

      const cutVisualMeasure = getCutVisualMeasure(cut.measure, cut.units);

      if (measuresMap && !(measuresMap.has(cutVisualMeasure.toFixed(2).replace(".", ",")))) {
        measuresMap.set(cutVisualMeasure.toFixed(2).replace(".", ","), cut.amount)
      } else if (measuresMap && measuresMap.has(cutVisualMeasure.toFixed(2).replace(".", ","))) {
        const currentAmount = measuresMap.get(cutVisualMeasure.toFixed(2).replace(".", ",")) ?? 0;
        measuresMap.set(cutVisualMeasure.toFixed(2).replace(".", ","), currentAmount + cut.amount);
      }

      prodMap.cuts.push(cut);
    }

    setCutsMap(map);
  }, []);

  const cutsMapSorted = useMemo(() => {
    const mapRes = new Map<string, {
      measuresMap: Map<string, number>,
      cuts: NonNullable<RouterOutputs['cuts']['list']>[number][],
    }>();

    cutsMap.forEach((cutMapped, key) => {
      const sorted = cutMapped.cuts.sort((a, b) => {
        let rA: typeof a, rB: typeof a;
        if (sortDir === 'asc') {
          rA = a;
          rB = b;
        } else {
          rA = b;
          rB = a;
        }

        switch (sortType) {
          case "caja": {
            const aNumCaja = Number(rA.caja);
            const bNumCaja = Number(rB.caja);

            if (Number.isNaN(aNumCaja) || !Number.isFinite(aNumCaja) || Number.isNaN(bNumCaja) || !Number.isFinite(bNumCaja)) {
              return (rA.caja ?? "").localeCompare(rB.caja ?? "")
            } else {
              return aNumCaja - bNumCaja;
            }
          }
          case "cant": {
            return rA.amount - rB.amount;
          }
          case "cod": {
            return rA.prodId.localeCompare(rB.prodId);
          }
          case "desc": {
            const descA = productsByCode[rA.prodId]!.description + " " + productsByCode[rA.prodId]!.additional_description;
            const descB = productsByCode[rB.prodId]!.description + " " + productsByCode[rB.prodId]!.additional_description;
            return descA.localeCompare(descB);
          }
          case "lote": {
            const aNumLote = Number(rA.lote);
            const bNumLote = Number(rB.lote);

            if (Number.isNaN(aNumLote) || !Number.isFinite(aNumLote) || Number.isNaN(bNumLote) || !Number.isFinite(bNumLote)) {
              return (rA.lote ?? "").localeCompare(rB.lote ?? "")
            } else {
              return aNumLote - bNumLote;
            }
          }
          case "med": {
            return rA.measure - rB.measure;
          }
          case "ubic": {
            const aNumUbic = Number(rA.location);
            const bNumUbic = Number(rB.location);

            if (Number.isNaN(aNumUbic) || !Number.isFinite(aNumUbic) || Number.isNaN(bNumUbic) || !Number.isFinite(bNumUbic)) {
              return (rA.location ?? "").localeCompare(rB.location ?? "")
            } else {
              return aNumUbic - bNumUbic;
            }
          }
          case "un": {
            return rA.units.localeCompare(rB.units);
          }
        }
      });

      mapRes.set(key, {
        cuts: sorted,
        measuresMap: cutMapped.measuresMap
      });
    });

    return mapRes;
  }, [cutsMap, sortType, sortDir]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#f7f7f7] text-[#3e3e3e]">
          <TableHead className="w-[400px]">Código producto</TableHead>
          <TableHead className="w-[400px]">Descripción</TableHead>
          <TableHead>Cantidad de recortes</TableHead>
          <TableHead>Total Metros</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from(cutsMapSorted).map(([prodId, prodMap]) =>
          <CutsTableElement
            key={`a-${prodId}`}
            prodId={prodId}
            prodMap={prodMap}
            productsByCode={productsByCode}
            setSortDir={setSortDir}
            setSortType={setSortType}
            sortDir={sortDir}
            sortType={sortType}
          />
        )}
      </TableBody>
    </Table>
  )
}

