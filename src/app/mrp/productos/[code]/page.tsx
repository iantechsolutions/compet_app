import AppLayout from "~/components/applayout";
import { getServerAuthSession } from "~/server/auth";
import ProductPage from "./product";

export default async function Home() {
    const session = await getServerAuthSession();

    return <ProductPage user={session?.user} />
  }