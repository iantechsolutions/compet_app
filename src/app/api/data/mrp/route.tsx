/* eslint-disable */

import { NextRequest, NextResponse } from "next/server";
import { queryBaseMRPData } from "~/mrp_data/query_mrp_data";
import { queryForecastData } from "~/mrp_data/query_mrp_forecast_data";
import { ForecastProfile, transformMRPData } from "~/mrp_data/transform_mrp_data";
import { encodeData } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { getSetting } from "~/lib/settings";
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { forecastProfiles } from "~/server/db/schema";
import { nullProfile } from "~/lib/nullForecastProfile";

export const runtime = 'edge'
export const maxDuration = 100;

export async function GET(req: NextRequest) {
    //!
    // TODO: CHECK AUTH
    const session = await getServerAuthSession()

    if (!session?.user) return new NextResponse(null, { status: 401 })

    const forecastProfileId = await getSetting<number>('mrp.current_forecast_profile')


    let forecastProfile: ForecastProfile | null = forecastProfileId != null ? (await db.query.forecastProfiles.findFirst({
        where: eq(forecastProfiles.id, forecastProfileId)
    }) ?? null) : null

    if (!forecastProfile) {
        forecastProfile = nullProfile
    }


    const mrpRawData = await queryBaseMRPData()
    const forecastData = await queryForecastData(forecastProfile, mrpRawData)

    const data = transformMRPData(mrpRawData, forecastData, forecastProfile)


    return new NextResponse(encodeData(data), {
        headers: {
            "Content-Type": "application/json"
        }
    });
}