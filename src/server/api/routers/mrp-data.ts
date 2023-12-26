import { getSetting } from "~/lib/settings";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { utapi } from "~/server/uploadthing";

export const mrpDataRouter = createTRPCRouter({
    mrpDataInfo: protectedProcedure.query(({ }) => {
        return getMrpExportInfo()
    }),
    obtainDataExportInfo: protectedProcedure.mutation(({ ctx }) => {
        return getMrpExportInfo()
    })
})

async function getMrpExportInfo() {
    const mrpExportFile = await getSetting<string>('mrp.export-file')
    const mrpExportDateStr = await getSetting<string>("mrp.export-date")

    const exportDate = mrpExportDateStr ? new Date(mrpExportDateStr) : new Date()

    if (!mrpExportFile) {
        throw new Error("No se encontró el archivo de exportación de datos. Se debe ejecutar el script `load-data`, asegurarse de configurar uploadthing correctamente.")
    }

    const [file] = await utapi.getFileUrls(mrpExportFile);

    return {
        exportURL: file!.url,
        exportDate: exportDate.toISOString()
    }
}