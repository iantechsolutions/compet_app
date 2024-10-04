"use client"
import { UploadDropzone } from "~/components/uploadthing"

export default function UploadDropZone() {
    return (
        
        <UploadDropzone
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
      />

    )
}

