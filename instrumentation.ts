
 
export async function register() {
  console.log("Registering service worker...");
  await fetch("/api/startmailchain");
}