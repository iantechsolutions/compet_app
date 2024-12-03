import cron from "node-cron";
import { cacheTask } from "./lib/cache";

let cronTask: cron.ScheduledTask | null = null;

export async function registerServer() {
  if (cronTask === null) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-member-access
    console.log("Starting cache cron job...");
    await cacheTask();
    cronTask = cron.schedule("0,5,10,15,20,25,30,35,40,45,50,55 * * * *", () => {
      console.log("Running cache task", new Date().toISOString());
      void (async () => {
        try {
          await cacheTask();
        } catch (k) {
          console.error("cacheTask error", k);
        }
      })();
    });
  }
}
