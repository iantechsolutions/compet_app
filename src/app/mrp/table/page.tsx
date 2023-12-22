
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { Button } from "~/components/ui/button";
import { getServerAuthSession } from "~/server/auth";
import jsonComplete from 'json-complete'

export default async function Home() {
    const session = await getServerAuthSession();

    return (
        <AppLayout
            title={<h1>COMPET MRP</h1>}
            user={session?.user}
            sidenav={<AppSidenav />}
            hideMenuOnDesktop
            noPadding
        >
            1
        </AppLayout>
    );
}