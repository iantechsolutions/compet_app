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
    getMailsConfig: protectedProcedure
        .input(
            z.object({
                userId: z.string(),
            }),
        ).query(async ({ ctx, input }) => {
            const firstCheck = await getUserSetting<number>('mrp.mails.firstSearch', input.userId);
            const secondCheck = await getUserSetting<number>('mrp.mails.secondSearch', input.userId)
            const BelowNMonths = await getUserSetting<number>('mrp.mails.ignoreIfMonths', input.userId)
            return { firstCheck, secondCheck, BelowNMonths };
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
        }),
    setMailConfig: protectedProcedure
        .input(
            z.object({
                firstCheck: z.number(),
                secondCheck: z.number(),
                BelowNMonths: z.number(),
                userId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (ctx.session.user.id !== input.userId) {
                throw new ClientSessionError('No puedes cambiar los correos de otro usuario')
            }
            await setUserSetting<number>('mrp.mails.firstSearch', input.userId, input.firstCheck ?? 2)
            await setUserSetting<number>('mrp.mails.secondSearch', input.userId, input.secondCheck ?? 12)
            await setUserSetting<number>('mrp.mails.ignoreIfMonths', input.userId, input.BelowNMonths ?? 0)
        })
})

