import { File } from "@web-std/file";
import "dotenv/config";
import { getSetting, setSetting } from "../../lib/settings";
import { encodeData } from "../../lib/utils";
import { utapi } from "../../server/uploadthing";
import { getDbInstance } from "./instance";

export async function loadDataFromTangoToCloud(opts?: { log: (...args: unknown[]) => unknown }) {
  const log = opts?.log ?? console.log;

  const db = await getDbInstance();
  const rawData = await db.readAllData();

  log("Datos leidos de la base de datos");

  const encoded = encodeData(rawData);

  // log("Datos codificados", "Tamaño:", encoded.length, `${encoded.substring(0, 100)}.....`)

  log("Subiendo datos al servidor...");

  const [uploaded] = await utapi.uploadFiles(
    [
      new File([encoded], "mrp-raw-data-export.flatted.json", {
        type: "application/json",
      }),
    ],
    {
      metadata: {
        date: new Date().toISOString(),
      },
    },
  );

  const lastUploadedFile = await getSetting<string>("mrp.export-file");

  const key = uploaded?.data?.key;
  if (!key) {
    throw new Error("[ERROR] No se pudo subir el archivo");
  }

  await setSetting("mrp.export-file", key);
  await setSetting<string>("mrp.export-date", new Date().toString());

  if (lastUploadedFile) {
    try {
      await utapi.deleteFiles(lastUploadedFile);
    } catch (error) {
      console.warn("No se pudo borrar el archivo anterior");
    }
  }

  log("Datos subidos al servidor");

  return rawData;
}
