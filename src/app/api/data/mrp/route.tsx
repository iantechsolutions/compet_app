/* eslint-disable */

import { NextRequest, NextResponse } from "next/server";
import { queryBaseMRPData } from "~/mrp_data/query_mrp_data";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { transformMRPData } from "~/mrp_data/transform_mrp_data";
import { encodeData } from "~/lib/utils";

let data: any = null

export async function GET(req: NextRequest) {
    //!
    // TODO: CHECK AUTH

    const forecastParams = { incrementFactor: 0.01 }

    if (!data) {
        const mrpRawData = await queryBaseMRPData()
        const forecastData = await queryForecastData(forecastParams)

        data = transformMRPData(mrpRawData, forecastData, forecastParams)
    }

    return new NextResponse(encodeData(data), {
        headers: {
            "Content-Type": "application/json"
        }
    });
}