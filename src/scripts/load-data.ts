import 'dotenv/config'
import { utapi } from '~/server/uploadthing'
import { readDataFromDB } from './lib/read-from-tango-db'
import { encodeData } from '~/lib/utils'

const rawData = await readDataFromDB()

console.log("Datos leidos de la base de datos")

const encoded = encodeData(rawData)

console.log("Datos codificados", "Tamaño:", encoded.length, `${encoded.substring(0, 100)}.....` )

console.log("Subiendo datos al servidor...")

await utapi.uploadFiles([
    new File([encoded], "mrp-raw-data-export.json", { type: "application/json" }),
], {
    metadata: {
        date: new Date().toISOString()
    }
})

console.log("Datos subidos al servidor")
console.log("Saliendo...")

process.exit(0)