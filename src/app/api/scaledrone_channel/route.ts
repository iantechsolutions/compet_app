import { NextApiRequest } from "next"
import { NextResponse } from "next/server"
import { env } from "~/env"
import { getServerAuthSession } from "~/server/auth"

export function GET(request: NextApiRequest) {
    const channel = env.SCALEDRONE_CHANNEL_ID
    const secret = env.SCALEDRONE_SECRET

    const session = getServerAuthSession()

    if (!session) {
        return Response.json({
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