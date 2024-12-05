import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import type { RouterOutputs } from "~/trpc/shared";
import type { Monolito } from "~/server/api/routers/db";
import CutsTableElement from "./cuts-table-element";
import { getCutVisualMeasure } from "~/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface Props {
  cuts: NonNullable<RouterOutputs['cuts']['list']>;
  productsByCode: Monolito['productsByCode'],
  filters: CutsFilters
  stockTangoMap: Map<string, number>,
}

export type CutsSortType = 'cod' | 'desc' | 'lote' | 'caja' | 'ubic' | 'cant' | 'med' | 'un' | 'dateMod';
export type CutsSortDir = 'asc' | 'desc';

export type CutsFilters = {
  prodCode: string;
  artCode: string;
  prodCodes: string[] | null;
  desc: string;
};

export type CutsFilterDispatch = Dispatch<SetStateAction<CutsFilters>>;

export default function CutsTable({ cuts, productsByCode, filters, stockTangoMap }: Props) {
  const [subTableSortType, setSubTableSortType] = useState<CutsSortType>('lote');
  const [subTableSortDir, setSubTableSortDir] = useState<CutsSortDir>('asc');

  const [sortType, setSortType] = useState<'code' | 'desc' | 'cant' | 'fis' | 'tango' | 'dif' | 'dateMod'>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
  }, [cuts]);

  // este sorting es interno de cada sub-tabla
  const cutsMapSorted = useMemo(() => {
    const mapRes = new Map<string, {
      measuresMap: Map<string, number>,
      cuts: NonNullable<RouterOutputs['cuts']['list']>[number][],
    }>();

    cutsMap.forEach((cutMapped, key) => {
      const sorted = cutMapped.cuts.sort((a, b) => {
        let rA: typeof a, rB: typeof a;
        if (subTableSortDir === 'asc') {
          rA = a;
          rB = b;
        } else {
          rA = b;
          rB = a;
        }

        switch (subTableSortType) {
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
          case "dateMod": {
            return (rA.modAt?.getTime() ?? 0) - (rB.modAt?.getTime() ?? 0);
          }
        }
      });

      mapRes.set(key, {
        cuts: sorted,
        measuresMap: cutMapped.measuresMap
      });
    });

    return mapRes;
  }, [cutsMap, subTableSortType, subTableSortDir, cuts]);

  const cutsMapSortedFiltered = useMemo(() => {
    let res = cutsMapSorted;

    const prodLower = filters.prodCode.toLowerCase();
    const descLower = filters.desc.toLowerCase();
    const anyFilter = filters.prodCode !== '' || filters.desc !== '' || filters.prodCodes !== null;

    if (anyFilter) {
      res = new Map(
        [...res]
          .filter(([k, _v]) => {
            if (filters.prodCodes !== null && !filters.prodCodes.includes(k)) {
              return false;
            } else if (filters.prodCode !== '' && !k.toLowerCase().includes(prodLower)) {
              return false;
            } else if (filters.desc !== '') {
              const desc = productsByCode[k]!.description + " " + productsByCode[k]!.additional_description;
              if (!desc.toLowerCase().includes(descLower)) {
                return false;
              }
            }

            return true;
          })
      );
    }

    return res;
  }, [filters, cutsMapSorted]);

  // este sorting es de la tabla grande en sí
  const sortedCutsMapSorted = useMemo(() => {
    const mapped: [string, {
      measuresMap: Map<string, number>,
      cuts: NonNullable<RouterOutputs['cuts']['list']>[number][],
      stockFis: number,
      stockTango: number,
      lastDate: number | null,
    }][] = Array.from(cutsMapSortedFiltered).map(prod => {
      // sacado del excel
      const defaultStockTango = Math.round(productsByCode[prod[0]]!.stock);
      const mapTango = stockTangoMap.get(prod[0]);

      let lastDate = 0;
      for (const cut of cuts) {
        if (typeof cut.modAt !== 'undefined' && cut.modAt !== null && cut.modAt.getTime() > lastDate) {
          lastDate = cut.modAt.getTime();
        }
      }

      if (typeof mapTango !== 'number') {
        console.warn('no mapTang', mapTango, prod[0]);
      }

      return [
        prod[0],
        {
          ...prod[1],
          stockFis: Number(prod[1].cuts.reduce((acc, v) => acc + (getCutVisualMeasure(v.measure, v.units) * v.amount), 0).toFixed(2)),
          stockTango: typeof mapTango === 'number' ? mapTango : defaultStockTango,
          lastDate: lastDate === 0 ? null : lastDate,
        }
      ];
    })

    return mapped.sort((a, b) => {
      const rA = sortDir === 'asc' ? a : b;
      const rB = sortDir === 'asc' ? b : a;

      const productA = productsByCode[rA[0]]!;
      const productB = productsByCode[rB[0]]!;

      if (sortType === 'dateMod') {
        return (rA[1].lastDate ?? 0) - (rB[1].lastDate ?? 0);
      } if (sortType === 'fis') {
        return rA[1].stockFis - rB[1].stockFis;
      } else if (sortType === 'desc') {
        return productA.description.localeCompare(productB.description);
      } else if (sortType === 'tango') {
        return rA[1].stockTango - rB[1].stockFis;
      } else if (sortType === 'dif') {
        return Math.round(rA[1].stockFis - rA[1].stockTango) - Math.round(rB[1].stockFis - rB[1].stockTango);
      } else if (sortType === 'cant') {
        return rA[1].measuresMap.size - rB[1].measuresMap.size;
      } else { // sortType === 'code'
        return productA.code.localeCompare(productB.code);
      }
    });
  }, [cutsMapSortedFiltered, sortDir, sortType]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#f7f7f7] text-[#3e3e3e]">
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'code') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('code');
                  setSortDir('asc');
                }
              }}>Código producto</button> {
                sortType === 'code' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'desc') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('desc');
                  setSortDir('asc');
                }
              }}>Descripción</button> {
                sortType === 'desc' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'cant') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('cant');
                  setSortDir('asc');
                }
              }}>Cantidad de recortes</button> {
                sortType === 'cant' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'fis') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('fis');
                  setSortDir('asc');
                }
              }}>Stock físico</button> {
                sortType === 'fis' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'tango') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('tango');
                  setSortDir('asc');
                }
              }}>Stock tango</button> {
                sortType === 'tango' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'dif') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('dif');
                  setSortDir('asc');
                }
              }}>Diferencia</button> {
                sortType === 'dif' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
          <TableHead>
            <div className="flex flex-row">
              <button onClick={() => {
                if (sortType === 'dateMod') {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                } else {
                  setSortType('dateMod');
                  setSortDir('asc');
                }
              }}>Última fecha de modificación</button> {
                sortType === 'dateMod' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
              }
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedCutsMapSorted.map(([prodId, prodMap]) =>
          <CutsTableElement
            key={`a-${prodId}`}
            prodId={prodId}
            prodMap={prodMap}
            productsByCode={productsByCode}
            setSortDir={setSubTableSortDir}
            setSortType={setSubTableSortType}
            sortDir={subTableSortDir}
            sortType={subTableSortType}
          />
        )}
      </TableBody>
    </Table>
  )
}

