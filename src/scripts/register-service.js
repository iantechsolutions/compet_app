import { serviceEntryPath, svc } from "./lib/service.js";

console.log(serviceEntryPath);

svc.on("install", () => {
  svc.start();
});

svc.install();
