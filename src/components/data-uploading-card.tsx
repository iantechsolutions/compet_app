import { Loader2Icon } from "lucide-react";
import { Card } from "./ui/card";
import { useMRPDataIsUpdating, useMRPLoadingMessage } from "./mrp-data-provider";

export default function DataUploadingCard() {
    const isUpdating = useMRPDataIsUpdating()
    const loadingMessage = useMRPLoadingMessage()

    return <>
        {isUpdating && <Card className="flex py-4 px-6 items-center max-w-[600px] mb-5">
            <Loader2Icon className="animate-spin mr-2" size={30} />
            <div className="ml-4">
                <p className="font-bold">Actualizando datos</p>
                <p className="text-xs">{loadingMessage}</p>
            </div>
        </Card>}
    </>
}