import { type FileRouter, createUploadthing } from "uploadthing/next";
import { z } from "zod";
import { createId } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import {api} from "~/trpc/server";
import * as schema from "~/server/db/schema";
import { db } from "~/server/db";
const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const session = await getServerAuthSession();

      // If you throw, the user will not be able to upload
      if (!session) throw new Error("Unauthorized");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for userId:", metadata.userId);

      console.log("file url", file.url);

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { uploadedBy: metadata.userId };
    }),

    excelUpload: f({
      "application/vnd.ms-excel": {
        maxFileCount: 1,
        maxFileSize: "128MB",
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        maxFileCount: 1,
        maxFileSize: "128MB",
      },
    })
      // Set permissions and file types for this FileRoute
      .middleware(async ({ req }) => {
        const session = await getServerAuthSession();

        // If you throw, the user will not be able to upload
        if (!session) throw new Error("Unauthorized");
  
        // Whatever is returned here is accessible in onUploadComplete as `metadata`
        return { userId: session.user.id };
      })
      .onUploadComplete(async ({ metadata, file }) => {
        console.log("Upload complete for userId:", metadata.userId);
        console.log("file url", file.url);
        // aca se sube a la base de datos: 
        const uploadId= createId();
        try{
          await db
          .insert(schema.excelCutsDocs)
          .values({
            id: uploadId,
            uploadAt: new Date(),
            url: file.url,
            fileName: file.name,
          })
          return { uploadId };
        }
        catch(e){
          console.log(e);
          throw new Error("Error uploading file");
        }
        // devolver 
        return { uploadedBy: metadata.userId, id:uploadId };
      }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
