import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { ListRowContainer } from "../consulta/consultPage";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/server";
import { cuts } from "~/server/db/schema";
import CutsPage from "./cutspage";
export default async function Page() {
   const cuts = await api.cuts.list.query();
    return (
        <AppLayout title={<h1>Tabla Recortes</h1>} sidenav={<AppSidenav />}>
          <CutsPage cuts={cuts}/>
        </AppLayout>
    )
}

