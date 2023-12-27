
import { svc, serviceEntryPath } from './lib/service.js'

console.log(serviceEntryPath)

svc.on('install', () => {
    svc.start();
});

svc.install();