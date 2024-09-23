import { forecastProfiles } from '~/server/db/schema'
// import { queryBaseMRPData, RawMRPData, transformClientsIdsCodes } from '~/mrp_data/query_mrp_data'
import { CronJob } from 'cron';
import { Resend } from 'resend';
import { env } from 'process'
import { EmailTemplate } from '~/components/email-template';
import { ForecastProfile, listAllEventsWithSupplyEvents, listProductsEvents, mapData, stockOfProductByMonth } from '~/mrp_data/transform_mrp_data';
import dayjs from 'dayjs';
import { queryForecastData } from '~/mrp_data/query_mrp_forecast_data';
import { getUserSetting } from '~/lib/settings';
import { db } from '~/server/db';
import { eq } from 'drizzle-orm';
import { nullProfile } from '~/lib/nullForecastProfile';
import { getMonths } from '~/lib/utils'
import { queryBaseMRPData } from '~/serverfunctions'
import { excludeProducts } from '~/server/api/constants'

 
export async function register() {
  console.log("Registering service worker...");
    let job = null
    
      async function sendMails(){
        const resend = new Resend(env.RESEND_API_KEY);
        type MappedData = ReturnType<typeof mapData>
    
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
    if(!job){
    job = new CronJob(
        '0 0 16 * * 1', // cronTime
        async function () {
            console.log("Started CronJob", new Date());
            
            const res = await sendMails();
        }, // onTick
        onComplete, // onComplete
        true, // start
        'UTC' // timeZone
    );
    job.start();

      function onComplete() {
        console.error("Cron Job Complete");
      };
    }
      
}