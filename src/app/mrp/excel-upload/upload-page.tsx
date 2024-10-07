
import AppSidenav from "~/components/app-sidenav";
import AppLayout from "~/components/applayout";
import UploadDropZone from "~/components/upload-docs/uploadDropZone"
export default function UploadPage() {
    const title = <h1>Subida Excel productos</h1>
    return (
        <AppLayout title={title} sidenav={<AppSidenav/>}>
            <h1 className="text-2xl">Subida de excel recortes</h1>
            <UploadDropZone/>
          

        </AppLayout>

    )
}

