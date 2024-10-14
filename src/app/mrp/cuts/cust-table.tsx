import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { ChevronDown } from "lucide-react";
interface Props {
    cutsMap: Map<string, Map<string, number>>;
}
export default function CutsTable({ cutsMap }: Props) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="bg-[#f7f7f7] text-[#3e3e3e]">
                    <TableHead className="w-[500px]">Código producto</TableHead>
                    <TableHead>Cantidad de recortes</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from(cutsMap).map(([prodId, prodMap]) => {
                    const [open, setOpen] = useState(false)
                    return (
                        <>
                            <TableRow key={prodId}>
                                <TableCell>{prodId}</TableCell>
                                <TableCell>{prodMap.size} recortes</TableCell>
                                <TableCell>
                                    <Button
                                        onClick={() => setOpen(!open)}
                                        variant="outline" size="icon" className="border-none shadow-none"> <ChevronDown className="h-5" /></Button>
                                </TableCell>
                            </TableRow>

                            {open && (
                                <TableRow>
                                    <TableCell colSpan={3}>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-[#f7f7f7] text-[#3e3e3e]">
                                                    <TableHead>Medida</TableHead>
                                                    {Array.from(prodMap).map(([measure, amount]) => (
                                                        <TableHead>{measure}</TableHead>
                                                    ))}
                                                </TableRow>
                                                <TableRow>
                                                    <TableHead>Cantidad</TableHead>
                                                    {Array.from(prodMap).map(([measure, amount]) => (
                                                        <TableCell>{amount}</TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                        </Table>
                                    </TableCell>
                                </TableRow>
                            )}
                        </>
                    )
                })}
            </TableBody>
        </Table>
    )
}

