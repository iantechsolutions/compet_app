/* eslint-disable */

import { type NextRequest, NextResponse } from "next/server";
import { cachedAsyncFetch } from "~/lib/cache";
import { getMonolitoByForecastId } from "~/lib/monolito";
import { getUserSetting } from "~/lib/settings";
import { defaultCacheTtl } from "~/scripts/lib/database";
import { getServerAuthSession } from "~/server/auth";

// export const runtime = "edge";
export const maxDuration = 100;

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  let data;
  const forecastProfileId = await getUserSetting<number>("mrp.current_forecast_profile", session?.user.id ?? '');
  if (forecastProfileId === null) {
    data = await cachedAsyncFetch(`monolito-fc-null`, defaultCacheTtl, async () => await getMonolitoByForecastId(null));
  } else {
    data = await cachedAsyncFetch(`monolito-fc-${forecastProfileId}`, defaultCacheTtl, async () => await getMonolitoByForecastId(forecastProfileId));
  }

  return new NextResponse(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
