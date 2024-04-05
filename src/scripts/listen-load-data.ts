import 'dotenv/config'
import { initialzeScaledroneListen } from './lib/scaledrone'

import dayjs from 'dayjs'

console.log(`[${dayjs().format('DD/MM/YYYY HH:mm:ss')}]`)
console.log('Script que escucha por actualizaciones de datos')

initialzeScaledroneListen()
