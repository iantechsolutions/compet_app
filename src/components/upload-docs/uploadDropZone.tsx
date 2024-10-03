"use client"
import { UploadDropzone } from "@uploadthing/react"
import { type OurFileRouter } from "~/app/api/uploadthing/core";
export default function UploadDropZone() {
    return (
        
        <UploadDropzone<OurFileRouter>
            endpoint="excelUpload"
            config={{
                mode: "manual",
                appendOnPaste: true,
            }}
            content={{
                button: "Continuar",
                allowedContent: "Archivos de excel",
                label: "Arrastra y suelta el archivo aquí",
            }}
            onClientUploadComplete={(res) => {
                const [file] = res;

                if (!file) return;
                // toast.success('Archivo!');
                console.log('Archivo subido');
            }}
            onUploadError={(error: Error) => {
               console.log('Error al subir archivo', error.message);
            }}
        />

    )
}

