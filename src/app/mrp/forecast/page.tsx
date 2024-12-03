import { getServerAuthSession } from "~/server/auth";
import ForecastSettingsPage from "./forecast-settings-page";

export default async function Page() {
  const session = await getServerAuthSession();

  return <ForecastSettingsPage user={session?.user} />;
}
