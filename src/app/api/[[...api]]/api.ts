import { Hono } from 'hono'
import { utapi } from '~/server/uploadthing'
import { forecastProfiles } from '~/server/db/schema'
import { useContext } from 'react'
import { dataProviderContext } from '~/components/mrp-data-provider'
// import { queryBaseMRPData, RawMRPData, transformClientsIdsCodes } from '~/mrp_data/query_mrp_data'
import { CronJob } from 'cron';
import { DataExport, readDataFromDB } from '~/scripts/lib/read-from-tango-db'
import { api } from '~/trpc/server';
import { getServerAuthSession } from '~/server/auth';
import { Resend } from 'resend';
import { env } from 'process'
import { EmailTemplate } from '~/components/email-template';
import { ForecastData, ForecastProfile, listAllEvents, listAllEventsWithSupplyEvents, listProductsEvents, mapData, ProductEvent, stockOfProductByMonth } from '~/mrp_data/transform_mrp_data';
import dayjs from 'dayjs';
import { queryForecastData } from '~/mrp_data/query_mrp_forecast_data';
import { getSetting, getUserSetting } from '~/lib/settings';
import { db } from '~/server/db';
import { eq } from 'drizzle-orm';
import { nullProfile } from '~/lib/nullForecastProfile';
import { decodeData, getMonths, monthCodeFromDate } from '~/lib/utils'
import { CrmBudget, CrmBudgetProduct, Order, OrderProductSold, Product, ProductAssembly, ProductImport, ProductProvider, ProductStockCommited } from '~/lib/types'
import { queryBaseMRPData } from '~/serverfunctions'
import { excludeProducts } from '~/server/api/constants'
const resend = new Resend(env.RESEND_API_KEY);
export const app = new Hono().basePath('/api')

app.get('/hello', (c) => {
    return c.json({ message: 'Hello, World!' })
})

app.get("/test",async (c)=>{
    const { data:emailData, error } = await resend.emails.send({
        from: 'desarrollo <pruebas@iantech.com.ar>',
        to: "info@iantech.com.ar" ?? "",
        subject: 'Productos faltantes',
        react: EmailTemplate({
            productList: []
        }),
    });
    console.log(error);
    return c.json(emailData);
})

app.get('/products',async (c)=>{
    const data = await queryBaseMRPData();
    const products = data.products;
    return c.json(products);
})


app.get("/startmailchain", async (c) => {
    type MappedData = ReturnType<typeof mapData>

    async function sendMails(){
        console.log("empieza", new Date());
        
        try{
        const visitedMails:string[] = [];
        const sessions = await db.query.sessions.findMany();
        sessions.forEach(async (session)=>{
        let mails = await getUserSetting<string[]>('mrp.mails', "")
        if (mails && mails.length > 0) {
            mails.forEach((mail)=>{
                if(!visitedMails.includes(mail)){
                    visitedMails.push(mail);
                }
                mails = (mails?.filter((mail)=> mail !== mail) ?? []);
            })
        const BelowNMonths = await getUserSetting<number>('mrp.mails.ignoreIfMonths',  "")
        const firstCheck = await getUserSetting<number>('mrp.mails.firstSearch',  "")
        const secondCheck = await getUserSetting<number>('mrp.mails.secondSearch', "")
        
        let rawdata = await queryBaseMRPData();
        rawdata.products = rawdata.products
        .filter(product =>
            !excludeProducts.some(excludedProduct => product.code.toLowerCase().startsWith(excludedProduct)));
        const forecastProfileId = await getUserSetting<number>('mrp.current_forecast_profile', session?.userId ?? "")
        let forecastProfile: ForecastProfile | null =
        forecastProfileId != null
                ? (await db.query.forecastProfiles.findFirst({
                    where: eq(forecastProfiles.id, forecastProfileId),
                })) ?? null
                : null

        if (!forecastProfile) {
            forecastProfile = nullProfile
        }
        const forecastData = await queryForecastData(forecastProfile, rawdata)
        const data = mapData(rawdata, forecastData)
        const events = listAllEventsWithSupplyEvents(data);
        const eventsByProductCode = listProductsEvents(data, events)
        const splicedMonths = getMonths(firstCheck ?? 2);
        const months = getMonths(secondCheck ?? 12);
        const _stockOfProductsByMonth = new Map<string, Map<string, number>>()
        for (const product of data.products) {
            _stockOfProductsByMonth.set(product.code, stockOfProductByMonth(product.stock, eventsByProductCode.get(product.code)!, months))
        }
        const finalList: {productCode:string, quantity: number, date:string, regularizationDate: string }[] = [];
        for (const product of data.products){
            const stockByMonth = _stockOfProductsByMonth.get(product.code) ?? new Map<string, number>();
            let critical = false;
            let quantity = 0;
            let criticalMonth = "";
            let fixedMonth = null;
            splicedMonths.map((month, index)=>{
                if((stockByMonth.get(month) ?? 0) < 0){
                    quantity = stockByMonth.get(month) ?? 0;
                    criticalMonth = month;
                    critical = true;
                }
            })
            const reversedMonths = months.toReversed();
            if(critical){
                let reversedMonths = months.toReversed();
                if(months.includes(criticalMonth)){
                    reversedMonths = months.slice(months.indexOf(criticalMonth)).toReversed();
                }
                reversedMonths.forEach((month, index)=>{
                    if((stockByMonth.get(month) ?? 0) >= 0){
                        fixedMonth = month;
                    }
                })
                if(fixedMonth){
                    if(dayjs(criticalMonth).diff(dayjs(fixedMonth), 'month') > (BelowNMonths ?? 0)){
                        finalList.push({productCode: product.code, quantity, date: criticalMonth, regularizationDate: fixedMonth});
                    }
                }
                else{
                    finalList.push({productCode: product.code, quantity, date: criticalMonth, regularizationDate: 'No hay fecha de regularización en los proximos ' + (secondCheck ?? 12) + ' meses'});
                }
                
            }
        }
        const { data:emailData, error } = await resend.emails.send({
            from: 'desarrollo <desarrollo@iantech.com.ar>',
            to: mails ?? "",
            subject: 'Productos faltantes',
            react: EmailTemplate({
                productList: finalList
            }),
        });
        }
        })
        await Promise.all(sessions);
        console.log("termina", new Date());
        return sessions;
    }
    catch(e){
        console.log(e);
    }
    }
    console.log("CurrentTime", new Date())
    const period = dateToCronPlus1(new Date())
    const job = new CronJob(
        '0 19 15 * * 1', // cronTime
        async function () {
            console.log("Started CronJob", new Date());
            
            // const res = await sendMails();
        }, // onTick
        onComplete, // onComplete
        true, // start
        'UTC' // timeZone
    );
      job.start();

      function onComplete() {
        console.error("Cron Job Complete");
      };
      return c.json("Empezada la cadena");
})




function dateToCronPlus1(date: Date): string {
    const minutes = date.getMinutes();
    const hours = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // Los meses en JS son 0 indexados, así que sumamos 1
    const dayOfWeek = date.getDay(); // Domingo es 0, Lunes es 1, etc.

    // Construimos la cadena en formato cron
    return `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
}





app.get("/individualMail", async (c) => {
    type MappedData = ReturnType<typeof mapData>
    async function sendMails(){
        console.log("empieza", new Date());
        
        try{
        const visitedMails:string[] = [];
        let mails = await getUserSetting<string[]>('mrp.mails',  "")
        if (mails && mails.length > 0) {
        const BelowNMonths = await getUserSetting<number>('mrp.mails.ignoreIfMonths',  "")
        const firstCheck = await getUserSetting<number>('mrp.mails.firstSearch', "")
        const secondCheck = await getUserSetting<number>('mrp.mails.secondSearch',"")
        
        let rawdata = await queryBaseMRPData();
        rawdata.products = rawdata.products
        .filter(product =>
            !excludeProducts.some(excludedProduct => product.code.toLowerCase().startsWith(excludedProduct.toLowerCase())));

        const forecastProfileId = await getUserSetting<number>('mrp.current_forecast_profile', "")
        let forecastProfile: ForecastProfile | null =
        forecastProfileId != null
                ? (await db.query.forecastProfiles.findFirst({
                    where: eq(forecastProfiles.id, forecastProfileId),
                })) ?? null
                : null

        if (!forecastProfile) {
            forecastProfile = nullProfile
        }
        const forecastData = await queryForecastData(forecastProfile, rawdata)
        const data = mapData(rawdata, forecastData)
        const events = listAllEventsWithSupplyEvents(data);
        const eventsByProductCode = listProductsEvents(data, events)
        const splicedMonths = getMonths(firstCheck ?? 2);
        const months = getMonths(secondCheck ?? 12);
        const _stockOfProductsByMonth = new Map<string, Map<string, number>>()
        for (const product of data.products) {
            _stockOfProductsByMonth.set(product.code, stockOfProductByMonth(product.stock, eventsByProductCode.get(product.code)!, months))
        }
        const finalList: {productCode:string, quantity: number, date:string, regularizationDate: string }[] = [];
        for (const product of data.products){
            const stockByMonth = _stockOfProductsByMonth.get(product.code) ?? new Map<string, number>();
            let critical = false;
            let quantity = 0;
            let criticalMonth = "";
            let fixedMonth = null;
            splicedMonths.map((month, index)=>{
                if((stockByMonth.get(month) ?? 0) < 0){
                    quantity = stockByMonth.get(month) ?? 0;
                    criticalMonth = month;
                    critical = true;
                }
            })
            const reversedMonths = months.toReversed();
            if(critical){
                let reversedMonths = months.toReversed();
                if(months.includes(criticalMonth)){
                    reversedMonths = months.slice(months.indexOf(criticalMonth)).toReversed();
                }
                reversedMonths.forEach((month, index)=>{
                    if((stockByMonth.get(month) ?? 0) >= 0){
                        fixedMonth = month;
                    }
                })
                if(fixedMonth){
                    if(dayjs(criticalMonth).diff(dayjs(fixedMonth), 'month') > (BelowNMonths ?? 0)){
                        finalList.push({productCode: product.code, quantity, date: criticalMonth, regularizationDate: fixedMonth});
                    }
                }
                else{
                    finalList.push({productCode: product.code, quantity, date: criticalMonth, regularizationDate: 'No hay fecha de regularización en los proximos ' + (secondCheck ?? 12) + ' meses'});
                }
                
            }
        }
        const { data:emailData, error } = await resend.emails.send({
            from: 'desarrollo <desarrollo@iantech.com.ar>',
            to: mails ?? "",
            subject: 'Productos faltantes',
            react: EmailTemplate({
                productList: finalList
            }),
        });
        console.log("error",error);
        }
        console.log("termina", new Date());
        return "sessionId";
    }
    catch(e){
        console.log(e);
    }
    }

    const res = await sendMails();
    return c.json("Enviado mail de muestra");
})


