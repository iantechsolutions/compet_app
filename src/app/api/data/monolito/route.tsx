/* eslint-disable */

import { type NextRequest, NextResponse } from "next/server";
import { getMonolitoBase } from "~/lib/monolito";
import { encodeData } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";

// export const runtime = "edge";
export const maxDuration = 100;

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const data = await getMonolitoBase(session?.user.id ?? '', 50000);

  return new NextResponse(encodeData(data), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
