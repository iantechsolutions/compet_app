/* eslint-disable */

import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { nullProfile } from '~/lib/nullForecastProfile'
import { getUserSetting } from '~/lib/settings'
import { encodeData } from '~/lib/utils'
import { queryBaseMRPData } from '~/mrp_data/query_mrp_data'
import { queryForecastData } from '~/mrp_data/query_mrp_forecast_data'
import { type ForecastProfile, transformMRPData } from '~/mrp_data/transform_mrp_data'
import { getServerAuthSession } from '~/server/auth'
import { db } from '~/server/db'
import { forecastProfiles } from '~/server/db/schema'

export const runtime = 'edge'
export const maxDuration = 100

export async function GET(req: NextRequest) {
    const session = await getServerAuthSession()

    if (!session?.user) return new NextResponse(null, { status: 401 })

    const forecastProfileId = await getUserSetting<number>('mrp.current_forecast_profile', session.user.id)

    let forecastProfile: ForecastProfile | null =
        forecastProfileId != null
            ? (await db.query.forecastProfiles.findFirst({
                  where: eq(forecastProfiles.id, forecastProfileId),
              })) ?? null
            : null

    if (!forecastProfile) {
        forecastProfile = nullProfile
    }

    const mrpRawData = await queryBaseMRPData()
    const forecastData = await queryForecastData(forecastProfile, mrpRawData)

    const data = transformMRPData(mrpRawData, forecastData, forecastProfile)

    return new NextResponse(encodeData(data), {
        headers: {
            'Content-Type': 'application/json',
        },
    })
}
