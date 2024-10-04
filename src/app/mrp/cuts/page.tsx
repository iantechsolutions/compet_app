import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";

export default function Page () {
    return (
        <AppLayout title={<h1>Tabla Recortes</h1>} sidenav={<AppSidenav />}>
            <h1>Tabla Recortes</h1>
            
        </AppLayout>
    )
}

