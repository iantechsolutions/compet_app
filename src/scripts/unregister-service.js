import { svc } from './lib/service.js'

svc.on('uninstall', () => {
    console.log('Uninstall complete.')
    console.log('The service exists: ', svc.exists)
})

// Uninstall the service.
svc.uninstall()
