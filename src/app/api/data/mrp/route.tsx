import { NextRequest, NextResponse } from "next/server";
import jsonComplete from 'json-complete'
import { queryBaseMRPData } from "~/mrp_data/query_mrp_data";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { transformMRPData } from "~/mrp_data/transform_mrp_data";

export async function GET(req: NextRequest) {
    const forecastParams = { incrementFactor: 0.01 }

    const mrpRawData = await queryBaseMRPData()
    const forecastData = await queryForecastData(forecastParams)

    const data = transformMRPData(mrpRawData, forecastData, forecastParams)
    
    return new NextResponse(jsonComplete.encode(data), {
        headers: {
            "Content-Type": "application/json"
        }
    });
}