
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import { api } from "~/trpc/server";
import UnconfirmedPage from "./unconfirmed-page";
interface Props {
    params: {
        uploadId: string;
    }
}
export default async function Page({ params }: Props) {
    const { uploadId } = params;
    const upload = await api.excelCutsDoc.get.query({ uploadId });
    const title = <h1>Confirmacion carga de datos</h1>

    return (
        <AppLayout title={title} sidenav={<AppSidenav />}>
            {
                !upload ? <h2>No se encontro archivo</h2> : <UnconfirmedPage upload={upload}/>
            }
            

        </AppLayout>
    )
}

