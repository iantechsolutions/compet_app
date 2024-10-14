"use client"
import { RouterOutputs } from "~/trpc/shared"
import dayjs from "dayjs";
import { FileSpreadsheetIcon,Loader2Icon } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react"
import { useState } from "react";
import { useRouter } from "next/navigation"
interface Props {
    upload: RouterOutputs["excelCutsDoc"]["get"]
}
export default function UnconfirmedPage({ upload }: Props) {
    const router = useRouter();
    const [data, setData] = useState<
        RouterOutputs["excelCutsDoc"]["deserialization"] | null
    >(null);
    const {
        mutateAsync: confirmData,
        error: dataError,
        isLoading: isDataLoading,
    } = api.excelCutsDoc.confirmData.useMutation();

    const {
        mutateAsync: readData,
        error: errorRead,
        isLoading: isReadingLoading,
    } = api.excelCutsDoc.deserialization.useMutation();

    async function handleRead() {
        const data = await readData({
            id: upload!.id,
        });
        setData(data);
    }
    async function handleConfirm() {
        await confirmData({
            uploadId: upload!.id,
        });
        router.push(`./`);
    }
    return (
        <>
            <Card className="flex items-center gap-3 p-3">
                <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-stone-100">
                    <FileSpreadsheetIcon />
                </div>
                <div className="">
                    <p className="font-medium text-md">{upload!.fileName}</p>
                    <p className="font-semibold text-xs">
                        subido el{" "}
                        {dayjs(upload!.uploadAt).format("DD/MM/YYYY [a las] HH:mm:ss")}
                    </p>
                </div>
            </Card>

            <div className="flex gap-1 pt-3">
                {/* <Button onClick={handleRead} disabled={isReadingLoading || isDataLoading}>
                    {isReadingLoading && <Loader2Icon className="mr-2 animate-spin" />}
                    Leer archivo
                </Button> */}
                <Button onClick={handleConfirm} disabled={isReadingLoading || isDataLoading} >
                    {isDataLoading && <Loader2Icon className="mr-2 animate-spin" />}
                    Escribir a la base de datos
                </Button>
            </div>

            {errorRead && (
                <pre className="mt-5 overflow-auto rounded-md border border-dashed p-4">
                    {errorRead?.data?.path?.trim() ?? errorRead?.message}
                </pre>
            )}

            {dataError && (
                <pre className="mt-5 overflow-auto rounded-md border border-dashed p-4">
                    {dataError?.data?.path?.trim() ?? dataError?.message}
                </pre>
            )}
        </>
    )
}

