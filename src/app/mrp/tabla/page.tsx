
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { Button } from "~/components/ui/button";
import { getServerAuthSession } from "~/server/auth";
import jsonComplete from 'json-complete'
import { Table } from "./table";

export default async function Home() {
    const session = await getServerAuthSession();

    return <Table user={session?.user} />
}