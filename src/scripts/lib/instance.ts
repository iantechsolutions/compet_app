import { Database } from "./database";

let dbInstance: Database | null = null;

export const getDbInstance = async (): Promise<Database> => {
    if (dbInstance === null) {
        const db = new Database();
        await db.open();
        dbInstance = db;
    }

    return getDbInstance;
}
