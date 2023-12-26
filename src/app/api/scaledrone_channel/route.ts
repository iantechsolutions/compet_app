import { NextApiRequest } from "next"
import { NextRequest, NextResponse } from "next/server"
import { env } from "~/env"
import { getServerAuthSession } from "~/server/auth"

export function GET(request: NextRequest) {
    const channel = env.SCALEDRONE_CHANNEL_ID
    const secret = env.SCALEDRONE_SECRET

    const session = getServerAuthSession()

    if (!session) {
        return NextResponse.json({
            error: 'Unauthorized'
        }, {
            status: 401
        })
    }

    if (!channel) {
        throw new Error('Missing Scaledrone channel ID. env.SCALEDRONE_CHANNEL_ID')
    }

    if (!secret) {
        throw new Error('Missing Scaledrone secret. env.SCALEDRONE_SECRET')
    }

    // const requestURL = new URL(request.url!.toString())

    return NextResponse.json({ channel })
}