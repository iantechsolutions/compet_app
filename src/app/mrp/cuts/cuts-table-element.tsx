import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ScissorsSquareIcon, Trash2Icon } from "lucide-react";
import { type Dispatch, type SetStateAction, useState } from "react";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import type { Monolito } from "~/server/api/routers/db";
import type { RouterOutputs } from "~/trpc/shared";
import type { CutsSortDir, CutsSortType } from "./cuts-table";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { CutDialog } from "./cuts-cut-dialog";
import { getCutVisualMeasure } from "~/lib/utils";

export default function CutsTableElement({
  prodId,
  prodMap,
  productsByCode,
  setSortType,
  sortType,
  setSortDir,
  sortDir,
}: {
  prodId: string,
  productsByCode: Monolito['productsByCode'],
  prodMap: {
    measuresMap: Map<string, number>,
    cuts: NonNullable<RouterOutputs['cuts']['list']>[number][],
  },
  setSortType: Dispatch<SetStateAction<CutsSortType>>,
  sortType: CutsSortType,
  setSortDir: Dispatch<SetStateAction<CutsSortDir>>,
  sortDir: CutsSortDir,
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const delMut = api.cuts.delete.useMutation();

  return (
    <>
      <TableRow key={prodId}>
        <TableCell>{prodId}</TableCell>
        <TableCell>{productsByCode[prodId]!.description + " " + productsByCode[prodId]!.additional_description}</TableCell>
        <TableCell>{prodMap.measuresMap.size} recortes</TableCell>
        <TableCell>
          {prodMap.cuts.reduce((acc, v) => acc + (getCutVisualMeasure(v.measure, v.units) * v.amount), 0).toFixed(2)}
        </TableCell>
        <TableCell>
          <Button
            onClick={() => setOpen(!open)}
            variant="outline" size="icon" className="border-none shadow-none"> {open ? <ChevronUp className="h-5" /> : <ChevronDown className="h-5" />}</Button>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow>
          <TableCell colSpan={4}>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-[#f7f7f7] text-[#3e3e3e]">
                  <TableHead>
                    <div className="flex flex-row">
                      <button onClick={() => {
                        if (sortType === 'cod') {
                          setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortType('cod');
                          setSortDir('asc');
                        }
                      }}>Código</button> {
                        sortType === 'cod' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
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
                      } </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex flex-row"><button onClick={() => {
                      if (sortType === 'lote') {
                        setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortType('lote');
                        setSortDir('asc');
                      }
                    }}>Lote</button> {
                        sortType === 'lote' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex flex-row"><button onClick={() => {
                      if (sortType === 'caja') {
                        setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortType('caja');
                        setSortDir('asc');
                      }
                    }}>Caja</button> {
                        sortType === 'caja' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex flex-row"><button onClick={() => {
                      if (sortType === 'ubic') {
                        setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortType('ubic');
                        setSortDir('asc');
                      }
                    }}>Ubicación</button> {
                        sortType === 'ubic' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex flex-row"><button onClick={() => {
                      if (sortType === 'cant') {
                        setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                      } else {
                        setSortType('cant');
                        setSortDir('asc');
                      }
                    }}>Cantidad</button> {
                        sortType === 'cant' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex flex-row">
                      <button onClick={() => {
                        if (sortType === 'med') {
                          setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortType('med');
                          setSortDir('asc');
                        }
                      }}>Medida</button> {
                        sortType === 'med' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex flex-row">
                      <button onClick={() => {
                        if (sortType === 'un') {
                          setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortType('un');
                          setSortDir('asc');
                        }
                      }}>Unidad</button> {
                        sortType === 'un' ? (sortDir === 'desc' ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>
                      } </div>
                  </TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(prodMap.cuts).map((cut) => (
                  <TableRow key={`cut-${cut.id}-${prodId}`}>
                    <TableCell>{cut.prodId}</TableCell>
                    <TableCell>{productsByCode[cut.prodId]!.description + " " + productsByCode[cut.prodId]!.additional_description}</TableCell>
                    <TableCell>{cut.lote}</TableCell>
                    <TableCell>{cut.caja}</TableCell>
                    <TableCell>{cut.location}</TableCell>
                    <TableCell>{cut.amount}</TableCell>
                    <TableCell>{getCutVisualMeasure(cut.measure, cut.units)}</TableCell>
                    <TableCell>{cut.units}</TableCell>
                    <TableCell className="px-1">
                      <CutDialog cut={cut}>
                        <ScissorsSquareIcon />
                      </CutDialog>
                    </TableCell>
                    <TableCell className="px-1">
                      <Button variant={'ghost'} onClick={() => {
                        void delMut.mutateAsync({
                          id: cut.id
                        }).then(_ => {
                          console.log('delMut ok for id', cut.id);
                          router.refresh();
                        }).catch(e => {
                          console.error(`delMut failed for id ${cut.id}`, e);
                        });
                      }}>
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}