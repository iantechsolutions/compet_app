/* eslint-disable @typescript-eslint/no-unsafe-member-access */
"use client";
import { ResponsiveContainer } from "recharts";
import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from '../ui/table';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from "lucide-react";
type ClientSales = {
  name: string;
  totalSales: number;
  amountOfSales: number;
}
interface graphicProps {
  data: ClientSales[];
}
export default function ClientUnitsSold({ data }: graphicProps) {

  const [sortedDesc, setSortedDesc] = useState(true);
  const [sortedBy, setSortedBy] = useState<'totalSales' | 'amountOfSales' | 'name'>('totalSales');
  // const []
  const [sortedClients, setSortedClients] = useState<ClientSales[]>([]);
  const [sortedClients15, setSortedClients15] = useState<ClientSales[]>([]);

  const other = {
    name: "Otros",
    totalSales: 0,
    amountOfSales: 0
  };

  useEffect(() => {
    other.amountOfSales = 0;
    other.totalSales = 0;

    const sortedClients15Res = sortedClients.slice(0, 9);
    if (sortedClients15Res.length < sortedClients.length) {
      for (let i = sortedClients15Res.length; i < sortedClients.length; i++) {
        other.totalSales += sortedClients[i]!.totalSales;
        other.amountOfSales += sortedClients[i]!.amountOfSales;
      }
    }

    if (other.totalSales > 0) {
      sortedClients15Res.push(other);
    }

    setSortedClients15(sortedClients15Res);
  }, [sortedClients]);

  useEffect(() => {
    const allSales = data;
    let sortedClientsRes: ClientSales[];
    if (sortedBy === 'totalSales') {
      if (sortedDesc) {
        sortedClientsRes = allSales.sort((a, b) => b.totalSales - a.totalSales);
      } else {
        sortedClientsRes = allSales.sort((a, b) => a.totalSales - b.totalSales);
      }
    } else if (sortedBy === 'amountOfSales') {
      if (sortedDesc) {
        sortedClientsRes = allSales.sort((a, b) => b.amountOfSales - a.amountOfSales);
      } else {
        sortedClientsRes = allSales.sort((a, b) => a.amountOfSales - b.amountOfSales);
      }
    } else {
      if (sortedDesc) {
        sortedClientsRes = allSales.sort((a, b) => b.name.localeCompare(a.name));
      } else {
        sortedClientsRes = allSales.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    other.amountOfSales = 0;
    other.totalSales = 0;

    const sortedClients15Res = sortedClientsRes.slice(0, 9);
    if (sortedClients15Res.length < sortedClientsRes.length) {
      for (let i = sortedClients15Res.length; i < sortedClientsRes.length; i++) {
        other.totalSales += sortedClientsRes[i]!.totalSales;
        other.amountOfSales += sortedClientsRes[i]!.amountOfSales;
      }
    }

    if (other.totalSales > 0) {
      sortedClients15Res.push(other);
    }

    setSortedClients15(sortedClients15Res);
    setSortedClients(sortedClientsRes);
  }, [sortedDesc, sortedBy]);

  return (
    <ResponsiveContainer width="48%" aspect={2}>
      <div className='h-full w-full flex flex-col justify-between'>
        <div className="border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f7f7f7] text-[#3e3e3e] text-sm">
                <TableHead className="w-[400px]">
                  <div className="flex flex-row">
                    <button onClick={() => {
                      if (sortedBy !== 'name') {
                        setSortedBy('name');
                        setSortedDesc(false);
                      } else {
                        setSortedDesc(!sortedDesc);
                      }
                    }}>Cliente</button>
                    {sortedBy === 'name' ? (sortedDesc ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>}
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex flex-row">
                    <button onClick={() => {
                      if (sortedBy !== 'totalSales') {
                        setSortedBy('totalSales');
                        setSortedDesc(true);
                      } else {
                        setSortedDesc(!sortedDesc);
                      }
                    }}>Cant. de uv</button>
                    {sortedBy === 'totalSales' ? (sortedDesc ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>}
                  </div>
                </TableHead> {/* totalSales */}
                <TableHead>
                  <div className="flex flex-row">
                    <button onClick={() => {
                      if (sortedBy !== 'amountOfSales') {
                        setSortedBy('amountOfSales');
                        setSortedDesc(true);
                      } else {
                        setSortedDesc(!sortedDesc);
                      }
                    }}>Cant. de ventas</button>
                    {sortedBy === 'amountOfSales' ? (sortedDesc ? <ArrowDown className="pl-2" /> : <ArrowUp className="pl-2" />) : <></>}
                  </div>
                </TableHead> {/* amountOfSales */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedClients15.map((sold) =>
                <TableRow key={`key-client-${sold.name}-${Math.random().toFixed(4)}`} className='text-base h-[4px]'>
                  <TableCell className={`py-1 h-[4px] ${sold === other ? 'text-gray-400' : ''}`}>{sold.name}</TableCell>
                  <TableCell className={`py-1 h-[4px] ${sold === other ? 'text-gray-400' : ''}`}>{sold.totalSales}</TableCell>
                  <TableCell className={`py-1 h-[4px] ${sold === other ? 'text-gray-400' : ''}`}>{sold.amountOfSales}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className='self-end font-semibold pt-2 text-center w-full'>Ventas a clientes</p>
      </div>
    </ResponsiveContainer>
  );
}

