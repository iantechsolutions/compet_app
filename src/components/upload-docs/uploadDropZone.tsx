"use client"
import { UploadDropzone } from "~/components/uploadthing"
import { useRouter } from "next/navigation";

export default function UploadDropZone() {
    const router = useRouter();
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
        onClientUploadComplete={(res)=>{
          const [file] = res;
          if (file){
            router.push(`/mrp/excel-upload/${file.serverData.id}`);
          }
        }
          
        }
      />

    )
}

