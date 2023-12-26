import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";
import jwt from 'jwt-simple'
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
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

    const requestURL = new URL(request.url!.toString())

    const clientId = requestURL.searchParams.get('client_id')

    if (!clientId) {
        return Response.json({
            error: 'Missing client_id query parameter'
        }, {
            status: 400
        })
    }

    const payload = {
        client: clientId, // the client that wants to connect
        channel: channel, // channel_id the client want's to connect to
        permissions: {
            '^request_data_update$': { /* Regex exact match to request_data_update */
                publish: true,  /* Allows publishing inrequest_data_update */
                subscribe: true
            },
            '^update_progress$': {
                publish: false,
                subscribe: true
            },
            '^data_updated$': {
                publish: false,
                subscribe: true
            }
        },
        exp: Date.now() + 180000 // Client can use this token for 3 minutes (UTC0)
    };

    const token = jwt.encode(payload, secret, 'HS256');

    return new Response(JSON.stringify({ token }))
}