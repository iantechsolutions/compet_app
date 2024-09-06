"use client"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Legend,
    Line
} from "recharts";

import { format, parse } from 'date-fns'

interface GraphicProps {
    data: {
        budgetsList: { date: string, totalBudgets: number }[];
        salesList: { date: string, totalSales: number }[];
    } | undefined;
}
export default function StackedAreaChart({ data }: GraphicProps) {
    const dataMap = new Map<string, { sales: number, budget: number }>();
    for (const budget of data?.budgetsList ?? []){
        if (!dataMap.has(budget.date)) {
            dataMap.set(budget.date, { sales: 0, budget: budget.totalBudgets });
        }
    }
    for (const sales of data?.salesList ?? []){
        if (dataMap.has(sales.date)) {
            const value = dataMap.get(sales.date);
            if (value) {
                value.sales = sales.totalSales;
                dataMap.set(sales.date, value);
            }
        }
        else {
            dataMap.set(sales.date, { sales: sales.totalSales, budget: 0 });
        }
    }
    // for (const budget of data.budgetsList) {
    //     if (!dataMap.has(budget.date)) {
    //         dataMap.set(budget.date, { sales: 0, budget: budget.totalBudgets });
    //     }
    // }

    // for (const sales of data.salesList) {
    //     if (dataMap.has(sales.date)) {
    //         dataMap.get(sales.date)!.sales = sales.totalSales;
    //     }
    //     else {
    //         dataMap.set(sales.date, { sales: sales.totalSales, budget: 0 });
    //     }
    // }

    const transformedData = Array.from(dataMap, ([name, { sales, budget }]) => ({ name, sales, budget }));

    return (
        <ResponsiveContainer width="48%" height="48%" aspect={2}>
            <>
            <p className=" py-2 pl-6">●  Cantidad de ventas y presupuestos en el periodo</p>
            
            <LineChart
                width={500}
                height={400}
                data={transformedData}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name"
                    tickFormatter={(tick: string) => {
                        const date = parse(tick, 'yyyy-MM-dd', new Date())
                        return format(date, 'MM/yyyy')
                    }}
                    interval={"preserveStartEnd"} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="budget" stroke="#82ca9d"  name="Presupuestos"/>
                <Line type="monotone" dataKey="sales" stroke="#8884d8" activeDot={{ r: 8 }} name="Ventas" />
            </LineChart>
            </>
        </ResponsiveContainer>
    );
}