import 'dotenv/config'
import { utapi } from '~/server/uploadthing'
import { readDataFromDB } from './lib/read-from-tango-db'
import { encodeData } from '~/lib/utils'
import { getSetting, setSetting } from '~/lib/settings'
import dayjs from 'dayjs'

console.log(`[${dayjs().format("DD/MM/YYYY HH:mm:ss")}]`)

const rawData = await readDataFromDB()

console.log("Datos leidos de la base de datos")

const encoded = encodeData(rawData)

console.log("Datos codificados", "Tamaño:", encoded.length, `${encoded.substring(0, 100)}.....`)

console.log("Subiendo datos al servidor...")

const [uploaded] = await utapi.uploadFiles([
    new File([encoded], "mrp-raw-data-export.flatted.json", { type: "application/json" }),
], {
    metadata: {
        date: new Date().toISOString()
    }
})

const lastUploadedFile = await getSetting<string>("mrp.export-file")

const key = uploaded?.data?.key
if (!key) {
    console.error("[ERROR] No se pudo subir el archivo")
    process.exit(0)
}

await setSetting("mrp.export-file", key)
await setSetting<string>("mrp.export-date", (new Date).toString())


if (lastUploadedFile) {
    try {
        await utapi.deleteFiles(lastUploadedFile)
    } catch (error) {
        console.warn("No se pudo borrar el archivo anterior")
    }
}

console.log("Datos subidos al servidor")
console.log("Saliendo...")

process.exit(0)