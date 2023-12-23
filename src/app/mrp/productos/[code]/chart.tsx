import { MRPProduct } from "~/mrp_data/transform_mrp_data";
import type { Props } from 'react-apexcharts/types/react-apexcharts'
type ApexOptions = Props['options']

// import dynamic from "next/dynamic";
import dayjs from "dayjs";
import { formatStock } from "~/lib/utils";
import Chart from 'react-apexcharts'

export function ProductEventsChart(props: { product: MRPProduct, months: string[] }) {
    const series = [
        {
            name: 'Importaciones',
            type: 'column',
            data: props.months.map((month) => {
                return props.product.imported_quantity_by_month.get(month) || 0
            }),
            // data: [44, 55, 41, 67, 22, 43, 21, 41, 56, 27, 43]
        },
        {
            name: 'Pedidos',
            type: 'column',
            data: props.months.map((month) => {
                return props.product.ordered_quantity_by_month.get(month) || 0
            }),
            // data: [23, 11, 22, 27, 13, 22, 37, 21, 44, 22, 30]
        },
        {
            name: 'Armados',
            type: 'column',
            data: props.months.map((month) => {
                return props.product.used_as_supply_quantity_by_month.get(month) || 0
            }),
            // data: [23, 11, 22, 27, 13, 22, 37, 21, 44, 22, 30]
        },
        {
            name: 'Stock',
            type: 'line',
            data: props.months.map((month) => {
                return props.product.stock_at.get(month) || 0
            }),
            // data: [30, 25, 36, 30, 45, 35, 64, 52, 59, 36, 39]
        },
        {
            name: 'Forecast',
            type: 'column',
            data: props.months.map((month) => {
                return props.product.used_as_forecast_quantity_by_month.get(month) || 0
            }),
            // data: [23, 11, 22, 27, 13, 22, 37, 21, 44, 22, 30]
        },
    ]

    const options: ApexOptions = {

        chart: {
            height: 350,
            type: 'line',
            stacked: false,
        },
        stroke: {
            width: [0, 2, 5],
            curve: 'smooth'
        },
        plotOptions: {
            bar: {
                columnWidth: '50%'
            }
        },

        fill: {
            opacity: [0.85, 0.25, 1],
            gradient: {
                inverseColors: false,
                shade: 'light',
                type: "vertical",
                opacityFrom: 0.85,
                opacityTo: 0.55,
                stops: [0, 100, 100, 100]
            }
        },
        labels: props.months,
        markers: {
            size: 0
        },
        xaxis: {
            type: 'datetime',
            labels: {
                formatter: function (value: string) {
                    return dayjs(value).format('YYYY-MM (MMMM)');
                }
            }

        },
        yaxis: {
            title: {
                style: {
                    fontSize: '14px',
                    fontWeight: 600,
                },
                text: 'Cantidad',
            },
            labels: {
                formatter: function (value: number) {
                    return value.toFixed(2);
                }
            },
            // min: 0
        },
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (y: number) {
                    if (typeof y !== "undefined") {
                        // return y.toFixed(2) + " metros";
                        return formatStock(y);
                    }
                    return y;

                }
            }
        },
    }

    return (
        <div id="chart">
            {/* {createElement(Chart as any, { options, series, type: "line", height: 350 })} */}
            <Chart 
                options={options} 
                series={series} 
                type="line" 
                height={350} 
                // className="w-full"
            />
        </div>
    );
}
