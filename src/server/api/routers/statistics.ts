import { number, z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { queryBaseMRPData } from '~/mrp_data/query_mrp_data'
import { ClientSessionError } from 'node_modules/next-auth/lib/client';

export const statisticsRouter = createTRPCRouter({
    getSalesAndBudgets: protectedProcedure
        .input(
            z.object({
                fromDate: z.date(),
                toDate  : z.date(),
                clientExemptionList: z.array(z.string()).nullable().default(null),
                providerExemptionList: z.array(z.string()).nullable().default(null),
                productCode: z.string(),
            }),
        ).mutation(async ({ ctx, input }) => {
        const data = await queryBaseMRPData();
        const fromDateCopy = new Date(input.fromDate);
        const budgets = data?.budgets.filter((budget) =>
            !input.clientExemptionList?.includes(budget.client_id) &&
            new Date(String(budget.date)) &&
            new Date(String(budget.date)) <= input.toDate &&
            new Date(String(budget.date)) >= fromDateCopy &&
            budget.products.filter((product) => product.product_code === input.productCode).length > 0
        );
        const sales = data?.orders.filter((order) => !input.clientExemptionList?.includes(order.client_code));
        let salesList = [];
        let budgetsList = [];
        while (fromDateCopy.getTime() <= input.toDate.getTime()) {
            const day = fromDateCopy.toISOString().slice(0, 10);
            const salesOnDay = sales?.filter((sale) =>
                new Date(String(sale?.order_date)) instanceof Date && !isNaN(new Date(String(sale.order_date)).getTime()) &&
                new Date(String(sale.order_date)).toISOString().slice(0, 10) === day
            );
            const budgetsOnDay = budgets?.filter((budget) =>
                new Date(String(budget.date)) instanceof Date && !isNaN(new Date(String(budget.date)).getTime()) &&
                new Date(String(budget.date)).toISOString().slice(0, 10) === day
            );
            let totalSales = 0;
            salesOnDay?.forEach((sale) => {
                const order_products = data.orderProducts.filter((order_product) => order_product.order_number === sale.order_number);
                // const order_products = data?.orderProductsByOrderNumber.get(sale.order_number);
                if ((order_products?.filter((order_product) => order_product.product_code === input.productCode)?.length ?? 0) > 0) {
                    const order_product = order_products?.find((order_product) => order_product.product_code === input.productCode);
                    totalSales += order_product?.ordered_quantity ?? 0;
                }
            });
            salesList.push({ date: day, totalSales });
            let totalBudgets = 0;
            budgetsOnDay?.forEach((budget) => {
                const product = budget.products.find((product) => product.product_code === input.productCode);
                if (product) {
                    totalBudgets += product.quantity;
                }
            });
            budgetsList.push({ date: day, totalBudgets });

            fromDateCopy.setDate(fromDateCopy.getDate() + 1);
        }
        return { salesList, budgetsList };
        }),

        getSoldProportions: protectedProcedure
        .input(
            z.object({
                fromDate: z.date(),
                toDate  : z.date(),
                clientExemptionList: z.array(z.string()).nullable().default(null),
                providerExemptionList: z.array(z.string()).nullable().default(null),
                productCode: z.string(),
            }),
        ).mutation(async ({ ctx, input }) => {
        const data = await queryBaseMRPData();
        const clientes = data.clients;
        const sales = data?.orders.filter((order) => !input.clientExemptionList?.includes(order.client_code) && new Date(String(order.order_date)) && new Date(String(order.order_date)) >= input.fromDate && new Date(String(order.order_date)) <= input.toDate);
        const clientInformation = new Map<string, [number, number]>()
        sales?.forEach((sale) => {
            const order_products = data.orderProducts.filter((order_product) => order_product.order_number === sale.order_number);
            if ((order_products?.filter((order_product) => order_product.product_code === input.productCode)?.length ?? 0) > 0) {
                const order_product = order_products?.find((order_product) => order_product.product_code === input.productCode)
                const [totalSales, amountOfSalse] = clientInformation.get(sale.client_code) ?? [0, 0];
                clientInformation.set(sale.client_code, [totalSales + (order_product?.ordered_quantity ?? 0), amountOfSalse + 1]);
            }
        });
        let finalArray:{ name: string | undefined; totalSales: number; amountOfSales: number; }[] = []
        const clientList = Array.from(clientInformation.entries()).forEach(([key, value]) => {
            const [totalSales, amountOfSales] = value;
            const name = clientes.find((client) => client.code === key)?.name;
            // return {name: name.toString(),}
            finalArray.push({ name: name?.toString() ?? "", totalSales, amountOfSales, });
            // return { name: data?.clients.find((client) => client.code === key)?.name, totalSales, amountOfSales, };
            });
        return finalArray;
        }),
        getGeneralStatistics: protectedProcedure
        .input(
            z.object({
                fromDate: z.date(),
                toDate  : z.date(),
                clientExemptionList: z.array(z.string()).nullable().default(null),
                providerExemptionList: z.array(z.string()).nullable().default(null),
                productCode: z.string(),
            }),
        ).mutation(async ({ ctx, input }) => {
        const data = await queryBaseMRPData();
            const sales = data?.orders.filter((order) => !input.clientExemptionList?.includes(order.client_code) && new Date(String(order.order_date)) >= input.fromDate && new Date(String(order.order_date)) <= new Date(String(input.toDate)));
        let validOrderProducts: {
            id: number;
            order_number: string;
            product_code: string;
            ordered_quantity: number;
        }[] = []
        sales?.forEach((sale) => {
            // const order_products = data?.orderProductsByOrderNumber.get(sale.order_number)
            const order_products = data.orderProducts.filter((order_product) => order_product.order_number === sale.order_number);
            if ((order_products?.filter((order_product) => order_product.product_code === input.productCode)?.length ?? 0) > 0) {
                const order_product = order_products?.find((order_product) => order_product.product_code === input.productCode)
                if (order_product) {
                    validOrderProducts.push(order_product);
                }
            }
        });
        const orderedQuantities = validOrderProducts.map((order_product) => order_product.ordered_quantity);
        const sortedQuantities = orderedQuantities.slice().sort((a, b) => a - b);
        const mid = Math.floor(sortedQuantities.length / 2);
        const median = sortedQuantities.length % 2 !== 0
            ? sortedQuantities[mid]
            : sortedQuantities[mid - 1];

        return {
            MaximumSales: orderedQuantities.length > 0 ? Math.max(...orderedQuantities) : 0,
            MinimumSales: orderedQuantities.length > 0 ? Math.min(...orderedQuantities) : 0,
            AverageSales: orderedQuantities.length > 0 ? orderedQuantities.reduce((acc, quantity) => acc + quantity, 0) / orderedQuantities.length : 0,
            TotalSales: orderedQuantities.length > 0 ? orderedQuantities.length : 0,
            MedianSales: orderedQuantities.length > 0 ? median : 0

        }
        })
})

