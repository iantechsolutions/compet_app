import 'dotenv/config'

import dayjs from 'dayjs'
import { loadDataFromTangoToCloud } from './lib/load-data-func'

console.log(`[${dayjs().format("DD/MM/YYYY HH:mm:ss")}]`)

try {
    await loadDataFromTangoToCloud()
} catch (error) {
    console.error(error)
    process.exit(1)
}

console.log("Saliendo...")

process.exit(0)