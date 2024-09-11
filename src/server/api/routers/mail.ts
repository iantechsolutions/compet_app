import { number, z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '../trpc'
import { queryBaseMRPData } from '~/mrp_data/query_mrp_data'
import { ClientSessionError } from 'node_modules/next-auth/lib/client';
import { getUserSetting, setUserSetting } from '~/lib/settings';

export const mailRouter = createTRPCRouter({
    getMails: protectedProcedure
        .input(
            z.object({
                userId: z.string(),
            }),
        ).query(async ({ ctx, input }) => {
            return await getUserSetting<string[]>('mrp.mails', input.userId);
        }),
    setMails: protectedProcedure
        .input(
            z.object({
                mails: z.array(z.string()).nullable().default(null),
                userId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (ctx.session.user.id !== input.userId) {
                throw new ClientSessionError('No puedes cambiar los correos de otro usuario')
            }
            await setUserSetting<string[]>('mrp.mails', input.userId, input.mails ?? [])
        })
})

