import { env } from "~/env";
import { Database } from "./database";

let dbInstance: Database | null = null;

export const getDbInstance = async (): Promise<Database> => {
    if (dbInstance === null) {
        const db = new Database();
        if (env.DB_DIRECT_CONNECTION) {
            await db.open();
        }
        dbInstance = db;
    }

    return dbInstance;
}
