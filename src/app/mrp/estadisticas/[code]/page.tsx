import { getServerAuthSession } from "~/server/auth";
import StatisticsPage from "./statistics";

export default async function Home() {
  const session = await getServerAuthSession();

  return <StatisticsPage user={session?.user} />;
}
