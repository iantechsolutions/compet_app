

// @ts-ignore
import { Service } from 'node-windows'

import path from 'path'

const url = new URL(import.meta.url)

const scriptPathname = url.pathname.substring(1)

const serviceEntryPath = path.join(scriptPathname, '../../service-entrypoint.js')

const svc = new Service({
    name: 'Compet MRP (actualización remota de datos)',
    description: 'Permite actualizar la base del MRP de forma remota.',
    script: serviceEntryPath,
    maxRestarts: 1000,
    wait: 10,
});

export { svc, serviceEntryPath };